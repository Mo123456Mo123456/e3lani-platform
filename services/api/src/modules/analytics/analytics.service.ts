import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdAnalyticsDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';

interface TrackedEvent {
  adId: string;
  type: string;
  occurredAt?: Date;
  watchedMs?: number;
  completed?: boolean;
  source: 'ORGANIC' | 'PROMOTED';
  cityId?: string;
}

const CLICK_TYPES = ['CLICK_WHATSAPP', 'CLICK_CALL', 'CLICK_STORE', 'CLICK_LINK'] as const;

/** تحليلات الإعلان لصاحب الإعلان. */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** استقبال أحداث العرض والتفاعل من التطبيقات (دفعات). */
  async track(
    deviceId: string,
    events: TrackedEvent[],
    userId?: string | null,
  ): Promise<{ accepted: number }> {
    const adIds = [...new Set(events.map((event) => event.adId))];
    const ads = await this.prisma.ad.findMany({
      where: { id: { in: adIds }, status: 'ACTIVE' },
      select: { id: true },
    });
    const validIds = new Set(ads.map((ad) => ad.id));
    const accepted = events.filter((event) => validIds.has(event.adId));
    if (!accepted.length) return { accepted: 0 };

    await this.prisma.adEvent.createMany({
      data: accepted.map((event) => ({
        adId: event.adId,
        userId: userId ?? null,
        deviceId,
        type: event.type as any,
        source: event.source,
        cityId: event.cityId ?? null,
        watchedMs: event.watchedMs ?? null,
        completed: Boolean(event.completed),
        createdAt: event.occurredAt ?? new Date(),
      })),
    });

    // تحديث العدادات السريعة على الإعلان
    const counters = new Map<string, { impressions: number; views: number; clicks: number }>();
    for (const event of accepted) {
      const entry = counters.get(event.adId) ?? { impressions: 0, views: 0, clicks: 0 };
      if (event.type === 'IMPRESSION') entry.impressions += 1;
      if (event.type === 'VIEW_START') entry.views += 1;
      if ((CLICK_TYPES as readonly string[]).includes(event.type)) entry.clicks += 1;
      counters.set(event.adId, entry);
    }

    await this.prisma.$transaction(
      [...counters.entries()].map(([adId, entry]) =>
        this.prisma.ad.update({
          where: { id: adId },
          data: {
            impressionsCount: { increment: entry.impressions },
            viewsCount: { increment: entry.views },
            clicksCount: { increment: entry.clicks },
          },
        }),
      ),
    );

    return { accepted: accepted.length };
  }

  async forAd(
    userId: string,
    adId: string,
    range: { from?: Date; to?: Date },
  ): Promise<AdAnalyticsDto> {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId }, select: { id: true, userId: true } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
    if (ad.userId !== userId) {
      throw new ForbiddenException({ message: 'هذه التحليلات لصاحب الإعلان فقط', code: 'FORBIDDEN' });
    }
    return this.compute(adId, range);
  }

  async compute(adId: string, range: { from?: Date; to?: Date }): Promise<AdAnalyticsDto> {
    const to = range.to ?? new Date();
    const from = range.from ?? new Date(to.getTime() - 30 * 86_400_000);
    const where = { adId, createdAt: { gte: from, lte: to } };

    const [grouped, uniqueDevices, watch, cityGroups, events] = await Promise.all([
      this.prisma.adEvent.groupBy({ by: ['type'], where, _count: { _all: true } }),
      this.prisma.adEvent.findMany({
        where: { ...where, type: 'IMPRESSION' },
        distinct: ['deviceId'],
        select: { deviceId: true },
      }),
      this.prisma.adEvent.aggregate({
        where: { ...where, type: { in: ['VIEW_START', 'VIEW_COMPLETE'] } },
        _avg: { watchedMs: true },
      }),
      this.prisma.adEvent.groupBy({
        by: ['cityId'],
        where: { ...where, type: 'IMPRESSION' },
        _count: { _all: true },
      }),
      this.prisma.adEvent.findMany({
        where,
        select: { type: true, createdAt: true, source: true },
        take: 20_000,
      }),
    ]);

    const countOf = (type: string) =>
      grouped.find((row) => row.type === type)?._count._all ?? 0;

    const impressions = countOf('IMPRESSION');
    const videoViews = countOf('VIEW_START');
    const completions = countOf('VIEW_COMPLETE');

    const cityIds = cityGroups.map((row) => row.cityId).filter((id): id is string => Boolean(id));
    const cities = cityIds.length
      ? await this.prisma.city.findMany({
          where: { id: { in: cityIds } },
          select: { id: true, nameAr: true, nameEn: true },
        })
      : [];

    const dailyMap = new Map<string, { impressions: number; clicks: number; videoViews: number }>();
    const hourMap = new Map<number, number>();
    const bySource: Record<'ORGANIC' | 'PROMOTED', number> = { ORGANIC: 0, PROMOTED: 0 };

    for (const event of events) {
      const day = event.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(day) ?? { impressions: 0, clicks: 0, videoViews: 0 };
      if (event.type === 'IMPRESSION') {
        entry.impressions += 1;
        hourMap.set(event.createdAt.getUTCHours(), (hourMap.get(event.createdAt.getUTCHours()) ?? 0) + 1);
        bySource[event.source as 'ORGANIC' | 'PROMOTED'] += 1;
      }
      if ((CLICK_TYPES as readonly string[]).includes(event.type)) entry.clicks += 1;
      if (event.type === 'VIEW_START') entry.videoViews += 1;
      dailyMap.set(day, entry);
    }

    const daily = [...dailyMap.entries()]
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const bestDay = daily.length
      ? daily.reduce((best, current) => (current.impressions > best.impressions ? current : best))
      : null;
    const bestHourEntry = [...hourMap.entries()].sort((a, b) => b[1] - a[1])[0];

    const clicks = {
      whatsapp: countOf('CLICK_WHATSAPP'),
      call: countOf('CLICK_CALL'),
      store: countOf('CLICK_STORE'),
      link: countOf('CLICK_LINK'),
      total: 0,
    };
    clicks.total = clicks.whatsapp + clicks.call + clicks.store + clicks.link;

    return {
      adId,
      range: { from: from.toISOString(), to: to.toISOString() },
      impressions,
      uniqueReach: uniqueDevices.length,
      videoViews,
      averageWatchMs: Math.round(watch._avg.watchedMs ?? 0),
      completionRate: videoViews ? Number((completions / videoViews).toFixed(4)) : 0,
      clicks,
      saves: countOf('SAVE'),
      shares: countOf('SHARE'),
      bySource,
      topCities: cityGroups
        .filter((row) => row.cityId)
        .map((row) => {
          const city = cities.find((item) => item.id === row.cityId);
          return {
            cityId: row.cityId!,
            nameAr: city?.nameAr ?? '',
            nameEn: city?.nameEn ?? '',
            impressions: row._count._all,
          };
        })
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5),
      bestDay: bestDay ? { date: bestDay.date, impressions: bestDay.impressions } : null,
      bestHour: bestHourEntry ? { hour: bestHourEntry[0], impressions: bestHourEntry[1] } : null,
      daily,
    };
  }

  /** ملخص عام للوحة الإدارة. */
  async platformOverview(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [users, businesses, activeAds, pendingReports, posts, tickerActive, revenue, newUsers, newAds] =
      await Promise.all([
        this.prisma.user.count({ where: { status: 'ACTIVE' } }),
        this.prisma.businessProfile.count(),
        this.prisma.ad.count({ where: { status: 'ACTIVE' } }),
        this.prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
        this.prisma.post.count({ where: { isActive: true } }),
        this.prisma.tickerRequest.count({ where: { status: 'ACTIVE' } }),
        this.prisma.payment.aggregate({
          where: { status: 'PAID', paidAt: { gte: since } },
          _sum: { amountHalalas: true },
          _count: { _all: true },
        }),
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
        this.prisma.ad.count({ where: { createdAt: { gte: since } } }),
      ]);

    return {
      users,
      businesses,
      activeAds,
      posts,
      pendingReports,
      tickerActive,
      revenueHalalas: revenue._sum.amountHalalas ?? 0,
      paymentsCount: revenue._count._all,
      newUsers,
      newAds,
      rangeDays: days,
    };
  }
}
