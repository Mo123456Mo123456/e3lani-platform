import { Injectable, Logger } from '@nestjs/common';
import {
  SETTING_KEYS, diversify, finalScore, freshnessDecay, geoScore, parseWeights,
  type RankingWeights,
} from '@e3lani/config';
import type { Prisma } from '@e3lani/database';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { SettingsService } from '../../common/services/settings.service';

interface RankingContext {
  viewerId?: string | null;
  deviceId?: string | null;
  cityId?: string | null;
  regionId?: string | null;
}

interface Candidate {
  id: string;
  advertiserId: string;
  score: number;
}

const CANDIDATE_LIMIT = 400;
const SEEN_WINDOW_HOURS = 48;

/**
 * محرّك ترتيب تبويب «لك» — يعمل بالكامل داخل الخادم بلا أي مزوّد خارجي.
 *
 * كيف يعمل:
 *  ١) يجمع مرشّحين من الإعلانات النشطة المطابقة لنطاق المستخدم.
 *  ٢) يحسب لكل إعلان درجة = جودة + تقارب + قرب + حداثة + دفعة مدفوعة − عقوبة تكرار.
 *  ٣) ينوّع النتائج فلا يسيطر معلن واحد على الموجز.
 *  ٤) يثبّت القائمة الناتجة في Redis لمدة الجلسة، فيبقى الترقيم مستقرًا
 *     ولا يرى المستخدم إعلانًا مكررًا أو يفقد آخر بين الصفحات.
 *
 * كل الأوزان تُقرأ من إعدادات لوحة الإدارة، ولا شيء منها مكتوب داخل المنطق.
 */
@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
  ) {}

  async weights(): Promise<RankingWeights> {
    return parseWeights(await this.settings.get(SETTING_KEYS.RANKING_WEIGHTS, null));
  }

  async isEnabled(): Promise<boolean> {
    return Boolean(await this.settings.get<boolean>(SETTING_KEYS.PERSONALIZED_FEED_ENABLED, true));
  }

  private sessionKey(context: RankingContext): string {
    const subject = context.viewerId ?? context.deviceId ?? 'anonymous';
    return `feed:rank:${subject}:${context.cityId ?? 'all'}`;
  }

  /** يبني ترتيبًا جديدًا ويثبّته للجلسة، ويعيد قائمة معرّفات الإعلانات مرتبة. */
  async buildRanking(context: RankingContext, where: Prisma.AdWhereInput): Promise<string[]> {
    const weights = await this.weights();
    const now = Date.now();

    const candidates = await this.prisma.ad.findMany({
      where,
      select: {
        id: true,
        userId: true,
        categoryId: true,
        cityId: true,
        reachScope: true,
        lastBumpedAt: true,
        publishedAt: true,
        highlightUntil: true,
        topOfCategoryUntil: true,
        city: { select: { regionId: true } },
        score: { select: { quality: true } },
      },
      orderBy: [{ lastBumpedAt: 'desc' }],
      take: CANDIDATE_LIMIT,
    });

    if (!candidates.length) return [];

    const [affinities, seen] = await Promise.all([
      this.affinityMap(context.viewerId),
      this.seenCounts(context, candidates.map((ad) => ad.id)),
    ]);

    const ranked: Candidate[] = candidates.map((ad) => {
      const ageHours = ad.lastBumpedAt
        ? (now - ad.lastBumpedAt.getTime()) / 3_600_000
        : (now - (ad.publishedAt?.getTime() ?? now)) / 3_600_000;

      const isPromoted =
        (ad.highlightUntil?.getTime() ?? 0) > now || (ad.topOfCategoryUntil?.getTime() ?? 0) > now;

      return {
        id: ad.id,
        advertiserId: ad.userId,
        score: finalScore(
          {
            quality: ad.score?.quality ?? 0,
            affinity: affinities.get(ad.categoryId) ?? 0,
            geo: geoScore({
              sameCity: Boolean(context.cityId) && ad.cityId === context.cityId,
              sameRegion:
                Boolean(context.regionId) && ad.city?.regionId === context.regionId,
              kingdomWide: ad.reachScope === 'KINGDOM',
            }),
            freshness: freshnessDecay(ageHours, weights.freshnessHalfLifeHours),
            isPromoted,
            seenCount: seen.get(ad.id) ?? 0,
          },
          weights,
        ),
      };
    });

    ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const ordered = diversify(ranked, weights.maxAdsPerAdvertiser).map((item) => item.id);

    await this.redis
      .setJson(this.sessionKey(context), ordered, weights.sessionTtlSeconds)
      .catch((error) => this.logger.warn(`تعذّر تثبيت ترتيب الجلسة: ${error.message}`));

    return ordered;
  }

  /** يعيد الترتيب المثبّت للجلسة إن وُجد، وإلا يبنيه من جديد. */
  async orderedIds(context: RankingContext, where: Prisma.AdWhereInput): Promise<string[]> {
    const cached = await this.redis.getJson<string[]>(this.sessionKey(context));
    if (cached?.length) return cached;
    return this.buildRanking(context, where);
  }

  /** تقارب المستخدم مع الأقسام — فارغ للزائر أو للمستخدم الجديد (بداية باردة). */
  private async affinityMap(viewerId?: string | null): Promise<Map<string, number>> {
    if (!viewerId) return new Map();
    const rows = await this.prisma.userCategoryAffinity.findMany({
      where: { userId: viewerId },
      select: { categoryId: true, score: true },
      orderBy: { score: 'desc' },
      take: 30,
    });
    return new Map(rows.map((row) => [row.categoryId, row.score]));
  }

  /** كم مرة رأى المستخدم كل إعلان خلال النافذة الأخيرة — لمنع تكرار العرض. */
  private async seenCounts(
    context: RankingContext,
    adIds: string[],
  ): Promise<Map<string, number>> {
    if (!adIds.length || (!context.viewerId && !context.deviceId)) return new Map();

    const rows = await this.prisma.adEvent.groupBy({
      by: ['adId'],
      where: {
        adId: { in: adIds },
        type: 'IMPRESSION',
        createdAt: { gte: new Date(Date.now() - SEEN_WINDOW_HOURS * 3_600_000) },
        ...(context.viewerId
          ? { userId: context.viewerId }
          : { deviceId: context.deviceId as string }),
      },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.adId, row._count._all]));
  }

  /** يبطل ترتيب الجلسة (يُستخدم عند تحديث المستخدم للموجز يدويًا). */
  async reset(context: RankingContext): Promise<void> {
    await this.redis.del(this.sessionKey(context));
  }
}
