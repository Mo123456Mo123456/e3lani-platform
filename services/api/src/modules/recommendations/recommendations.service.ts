import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InteractionType, ImpressionSource, Prisma } from '@prisma/client';
import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  buildColdStartProfile,
  createRecommendationAdapter,
  normalizeWeights,
  type AdCandidate,
  type ImpressionSource as Source,
  type RankedAd,
  type RecommendationAdapter,
  type RecommendationWeights,
  type UserTasteProfile,
} from '@e3lani/recommendations';
import Redis from 'ioredis';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';

const interactionSchema = z.object({
  adId: z.string().uuid(),
  type: z.enum([
    'IMPRESSION',
    'VIEW',
    'WATCH_DURATION',
    'SAVE',
    'UNSAVE',
    'CLICK_WHATSAPP',
    'CLICK_STORE',
    'CLICK_CALL',
    'CLICK_EXTERNAL',
    'SHARE',
    'SKIP',
    'DISMISS',
  ]),
  value: z.number().finite().optional(),
  source: z.enum(['ORGANIC', 'PAID', 'SMART_RECOMMENDATION']).optional(),
  feedTab: z.string().max(32).optional(),
  platform: z.string().max(32).optional(),
  sessionId: z.string().max(128).optional(),
});

const interactionsBatchSchema = z.object({
  interactions: z.array(interactionSchema).min(1).max(50),
});

const WEIGHTS_KEY = 'recommendation_weights';

@Injectable()
export class RecommendationsService implements OnModuleDestroy {
  private readonly log = new Logger(RecommendationsService.name);
  private readonly adapter: RecommendationAdapter;
  private redis: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.adapter = createRecommendationAdapter(process.env.RECOMMENDATION_ADAPTER);
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.redis.connect().catch((err) => {
        this.log.warn(`Redis unavailable for recommendations: ${(err as Error).message}`);
        this.redis = null;
      });
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  async getWeights(): Promise<RecommendationWeights> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: WEIGHTS_KEY } });
    if (!setting?.value || typeof setting.value !== 'object') {
      return DEFAULT_RECOMMENDATION_WEIGHTS;
    }
    return normalizeWeights(setting.value as Partial<RecommendationWeights>);
  }

  async updateWeights(actorId: string, partial: Partial<RecommendationWeights>) {
    const next = normalizeWeights({ ...(await this.getWeights()), ...partial });
    await this.prisma.systemSetting.upsert({
      where: { key: WEIGHTS_KEY },
      create: { key: WEIGHTS_KEY, value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'recommendations.weights.update',
        entityType: 'system_setting',
        entityId: WEIGHTS_KEY,
        after: next as unknown as Prisma.InputJsonValue,
      },
    });
    await this.bustCaches();
    return next;
  }

  async recordInteractions(
    body: unknown,
    userId?: string,
  ): Promise<{ ok: true; count: number }> {
    const input = interactionsBatchSchema.parse(body);
    for (const row of input.interactions) {
      await this.prisma.userInteraction.create({
        data: {
          userId,
          sessionId: row.sessionId,
          adId: row.adId,
          type: row.type as InteractionType,
          value: row.value,
          source: (row.source as ImpressionSource | undefined) ?? null,
          feedTab: row.feedTab,
          platform: row.platform,
        },
      });
      await this.bumpEngagementStats(row.adId, row.type as InteractionType, row.value);
      // Mirror into AnalyticsEvent for existing dashboards + source tagging.
      await this.prisma.analyticsEvent.create({
        data: {
          name: `interaction.${row.type.toLowerCase()}`,
          adId: row.adId,
          userId,
          sessionId: row.sessionId,
          platform: row.platform,
          payload: {
            source: row.source ?? 'SMART_RECOMMENDATION',
            feedTab: row.feedTab ?? null,
            value: row.value ?? null,
          },
        },
      });
    }
    if (userId) await this.invalidateUserCache(userId);
    return { ok: true, count: input.interactions.length };
  }

  async forYouRanked(params: {
    userId?: string;
    cityId?: string;
    cursor?: string;
    take: number;
  }): Promise<{
    ranked: RankedAd[];
    adapter: string;
    coldStart: boolean;
    weightsVersion: string;
  }> {
    const weights = await this.getWeights();
    const take = Math.min(Math.max(params.take, 1), 50);
    const cacheKey =
      params.userId || params.cityId
        ? `fy:${params.userId ?? 'anon'}:${params.cityId ?? 'na'}:${params.cursor ?? '0'}:${take}`
        : null;

    if (cacheKey && this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as {
            ranked: RankedAd[];
            adapter: string;
            coldStart: boolean;
            weightsVersion: string;
          };
        }
      } catch {
        // continue without cache
      }
    }

    const [user, candidates] = await Promise.all([
      this.buildUserProfile(params.userId, params.cityId, weights),
      this.loadCandidates(weights.candidatePoolSize),
    ]);

    let pool = candidates;
    if (params.cursor) {
      const idx = pool.findIndex((c) => c.id === params.cursor);
      if (idx >= 0) pool = pool.slice(idx + 1);
    }

    const ranked = (await this.adapter.rank({ user, candidates: pool, weights })).slice(0, take);
    const payload = {
      ranked,
      adapter: this.adapter.name,
      coldStart: user.isColdStart,
      weightsVersion: 'recommendation_weights',
    };

    if (cacheKey && this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', weights.cacheTtlSeconds);
      } catch {
        // ignore
      }
    }

    return payload;
  }

  async performanceReport() {
    const since = new Date(Date.now() - 7 * 24 * 3600_000);
    const [forYou, nearby, latest, bySource] = await Promise.all([
      this.engagementForTab('forYou', since),
      this.engagementForTab('nearby', since),
      this.engagementForTab('latest', since),
      this.prisma.userInteraction.groupBy({
        by: ['source'],
        where: { createdAt: { gte: since }, type: { in: ['SAVE', 'CLICK_WHATSAPP', 'CLICK_STORE', 'CLICK_CALL'] } },
        _count: { _all: true },
      }),
    ]);

    return {
      windowDays: 7,
      tabs: { forYou, nearby, latest },
      engagementBySource: bySource.map((row) => ({
        source: row.source ?? 'UNKNOWN',
        engagements: row._count._all,
      })),
      adapter: this.adapter.name,
      weights: await this.getWeights(),
      generatedAt: new Date().toISOString(),
    };
  }

  private async engagementForTab(feedTab: string, since: Date) {
    const [impressions, engagements] = await Promise.all([
      this.prisma.userInteraction.count({
        where: { feedTab, createdAt: { gte: since }, type: { in: ['IMPRESSION', 'VIEW'] } },
      }),
      this.prisma.userInteraction.count({
        where: {
          feedTab,
          createdAt: { gte: since },
          type: { in: ['SAVE', 'CLICK_WHATSAPP', 'CLICK_STORE', 'CLICK_CALL', 'SHARE'] },
        },
      }),
    ]);
    const rate = impressions > 0 ? engagements / impressions : 0;
    return { impressions, engagements, engagementRate: Number(rate.toFixed(4)) };
  }

  private async buildUserProfile(
    userId: string | undefined,
    cityId: string | undefined,
    weights: RecommendationWeights,
  ): Promise<UserTasteProfile> {
    if (!userId) return buildColdStartProfile(cityId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, cityId: true },
    });
    const resolvedCity = cityId ?? user?.cityId ?? null;

    const since = new Date(Date.now() - 45 * 24 * 3600_000);
    const interactions = await this.prisma.userInteraction.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        ad: {
          select: {
            id: true,
            currentRevision: { select: { categoryId: true, cityId: true, category: { select: { parentId: true } } } },
            media: { select: { kind: true }, take: 1 },
          },
        },
      },
    });

    if (interactions.length < 3) {
      return { ...buildColdStartProfile(resolvedCity), userId, interactionCount: interactions.length };
    }

    const preferredCategoryIds: Record<string, number> = {};
    const preferredCityIds: Record<string, number> = {};
    const preferredMediaKinds: Record<string, number> = {};
    const likedAdIds: string[] = [];
    const positive = new Set([
      'SAVE',
      'CLICK_WHATSAPP',
      'CLICK_STORE',
      'CLICK_CALL',
      'CLICK_EXTERNAL',
      'SHARE',
      'WATCH_DURATION',
      'VIEW',
    ]);

    for (const row of interactions) {
      const weight =
        row.type === 'SAVE' || row.type.startsWith('CLICK')
          ? 3
          : row.type === 'WATCH_DURATION'
            ? Math.min(3, (row.value ?? 0) / 15)
            : row.type === 'SKIP' || row.type === 'DISMISS'
              ? -1.5
              : 1;
      const rev = row.ad.currentRevision;
      if (rev?.categoryId) {
        preferredCategoryIds[rev.categoryId] = (preferredCategoryIds[rev.categoryId] ?? 0) + weight;
        if (rev.category?.parentId) {
          preferredCategoryIds[rev.category.parentId] =
            (preferredCategoryIds[rev.category.parentId] ?? 0) + weight * 0.4;
        }
      }
      if (rev?.cityId) {
        preferredCityIds[rev.cityId] = (preferredCityIds[rev.cityId] ?? 0) + weight;
      }
      const kind = row.ad.media[0]?.kind === 'VIDEO' ? 'video' : row.ad.media[0] ? 'image' : null;
      if (kind) preferredMediaKinds[kind] = (preferredMediaKinds[kind] ?? 0) + Math.max(weight, 0);
      if (positive.has(row.type) && weight > 0) likedAdIds.push(row.adId);
    }

    const collaborativeScores =
      likedAdIds.length >= weights.collaborativeMinInteractions
        ? await this.computeCollaborativeScores(userId, likedAdIds)
        : {};

    return {
      userId,
      cityId: resolvedCity,
      preferredCategoryIds,
      preferredCityIds,
      preferredMediaKinds,
      likedAdIds: [...new Set(likedAdIds)].slice(0, 100),
      collaborativeScores,
      interactionCount: interactions.length,
      isColdStart: interactions.length < weights.collaborativeMinInteractions,
    };
  }

  /**
   * Item-item collaborative filtering on co-liked ads (users who liked same ads).
   * Limited sample for performance at tens of thousands of users.
   */
  private async computeCollaborativeScores(
    userId: string,
    likedAdIds: string[],
  ): Promise<Record<string, number>> {
    const seed = likedAdIds.slice(0, 40);
    const neighborRows = await this.prisma.userInteraction.findMany({
      where: {
        adId: { in: seed },
        userId: { not: userId },
        type: { in: ['SAVE', 'CLICK_WHATSAPP', 'CLICK_STORE', 'CLICK_CALL', 'SHARE'] },
      },
      select: { userId: true },
      take: 800,
    });
    const neighborIds = [...new Set(neighborRows.map((r) => r.userId).filter(Boolean))] as string[];
    if (neighborIds.length === 0) return {};

    const neighborLikes = await this.prisma.userInteraction.findMany({
      where: {
        userId: { in: neighborIds.slice(0, 120) },
        type: { in: ['SAVE', 'CLICK_WHATSAPP', 'CLICK_STORE', 'CLICK_CALL', 'SHARE'] },
        adId: { notIn: seed },
      },
      select: { adId: true },
      take: 2000,
    });

    const scores: Record<string, number> = {};
    for (const row of neighborLikes) {
      scores[row.adId] = (scores[row.adId] ?? 0) + 1;
    }
    const max = Math.max(1, ...Object.values(scores));
    for (const key of Object.keys(scores)) {
      scores[key] = scores[key] / max;
    }
    return scores;
  }

  private async loadCandidates(poolSize: number): Promise<AdCandidate[]> {
    const ads = await this.prisma.ad.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: [{ isSponsored: 'desc' }, { isFeatured: 'desc' }, { publishedAt: 'desc' }],
      take: poolSize,
      select: {
        id: true,
        ownerId: true,
        isFeatured: true,
        isSponsored: true,
        publishedAt: true,
        currentRevision: {
          select: {
            categoryId: true,
            cityId: true,
            category: { select: { parentId: true } },
          },
        },
        media: { select: { kind: true }, take: 3 },
        engagementStats: true,
      },
    });

    return ads.map((ad) => {
      const kinds = ad.media.map((m) => m.kind);
      let mediaKind: AdCandidate['mediaKind'] = null;
      if (kinds.includes('VIDEO') && kinds.some((k) => k === 'IMAGE')) mediaKind = 'mixed';
      else if (kinds.includes('VIDEO')) mediaKind = 'video';
      else if (kinds.includes('IMAGE')) mediaKind = 'image';

      const stats = ad.engagementStats;
      return {
        id: ad.id,
        ownerId: ad.ownerId,
        categoryId: ad.currentRevision?.categoryId ?? null,
        parentCategoryId: ad.currentRevision?.category?.parentId ?? null,
        cityId: ad.currentRevision?.cityId ?? null,
        mediaKind,
        isFeatured: ad.isFeatured,
        isSponsored: ad.isSponsored,
        publishedAt: ad.publishedAt,
        stats: {
          impressions: stats?.impressions ?? 0,
          views: stats?.views ?? 0,
          saves: stats?.saves ?? 0,
          whatsappClicks: stats?.whatsappClicks ?? 0,
          storeClicks: stats?.storeClicks ?? 0,
          callClicks: stats?.callClicks ?? 0,
          shares: stats?.shares ?? 0,
          skips: stats?.skips ?? 0,
          videoCompletions: stats?.videoCompletions ?? 0,
          videoWatchCount: stats?.videoWatchCount ?? 0,
        },
      };
    });
  }

  private async bumpEngagementStats(adId: string, type: InteractionType, value?: number) {
    const data: Prisma.AdEngagementStatsUpdateInput = {};
    switch (type) {
      case 'IMPRESSION':
        data.impressions = { increment: 1 };
        break;
      case 'VIEW':
        data.views = { increment: 1 };
        break;
      case 'SAVE':
        data.saves = { increment: 1 };
        break;
      case 'UNSAVE':
        data.saves = { decrement: 1 };
        break;
      case 'CLICK_WHATSAPP':
        data.whatsappClicks = { increment: 1 };
        break;
      case 'CLICK_STORE':
        data.storeClicks = { increment: 1 };
        break;
      case 'CLICK_CALL':
        data.callClicks = { increment: 1 };
        break;
      case 'CLICK_EXTERNAL':
        data.externalClicks = { increment: 1 };
        break;
      case 'SHARE':
        data.shares = { increment: 1 };
        break;
      case 'SKIP':
      case 'DISMISS':
        data.skips = { increment: 1 };
        break;
      case 'WATCH_DURATION':
        data.videoWatchSumSec = { increment: value ?? 0 };
        data.videoWatchCount = { increment: 1 };
        if ((value ?? 0) >= 0.85 || (value ?? 0) >= 45) {
          data.videoCompletions = { increment: 1 };
        }
        break;
      default:
        break;
    }

    await this.prisma.adEngagementStats.upsert({
      where: { adId },
      create: {
        adId,
        impressions: type === 'IMPRESSION' ? 1 : 0,
        views: type === 'VIEW' ? 1 : 0,
        saves: type === 'SAVE' ? 1 : 0,
        whatsappClicks: type === 'CLICK_WHATSAPP' ? 1 : 0,
        storeClicks: type === 'CLICK_STORE' ? 1 : 0,
        callClicks: type === 'CLICK_CALL' ? 1 : 0,
        externalClicks: type === 'CLICK_EXTERNAL' ? 1 : 0,
        shares: type === 'SHARE' ? 1 : 0,
        skips: type === 'SKIP' || type === 'DISMISS' ? 1 : 0,
        videoWatchSumSec: type === 'WATCH_DURATION' ? value ?? 0 : 0,
        videoWatchCount: type === 'WATCH_DURATION' ? 1 : 0,
        videoCompletions:
          type === 'WATCH_DURATION' && ((value ?? 0) >= 0.85 || (value ?? 0) >= 45) ? 1 : 0,
      },
      update: data,
    });

    // Refresh denormalized popularity score opportunistically.
    const stats = await this.prisma.adEngagementStats.findUnique({ where: { adId } });
    if (!stats) return;
    const impressions = Math.max(stats.impressions, 1);
    const popularity =
      (stats.saves / impressions) * 0.35 +
      ((stats.whatsappClicks + stats.storeClicks + stats.callClicks + stats.shares) / impressions) *
        0.4 +
      (stats.videoWatchCount > 0 ? stats.videoCompletions / stats.videoWatchCount : 0) * 0.25;
    await this.prisma.adEngagementStats.update({
      where: { adId },
      data: { popularityScore: popularity },
    });
  }

  private async invalidateUserCache(userId: string) {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(`fy:${userId}:*`);
      if (keys.length) await this.redis.del(...keys);
    } catch {
      // ignore
    }
  }

  private async bustCaches() {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys('fy:*');
      if (keys.length) await this.redis.del(...keys);
    } catch {
      // ignore
    }
  }
}

export type { Source };
