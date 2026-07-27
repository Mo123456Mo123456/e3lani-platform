import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { analyticsEventsSchema } from '@e3lani/validation';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvents(body: unknown, userId?: string) {
    const input = analyticsEventsSchema.parse(body);
    if (input.events.length === 0) return { ok: true, count: 0 };

    await this.prisma.analyticsEvent.createMany({
      data: input.events.map((event) => ({
        name: event.name,
        adId: event.adId,
        userId,
        sessionId: event.sessionId,
        platform: event.platform,
        locale: event.locale,
        payload: event.payload as Prisma.InputJsonValue | undefined,
      })),
    });

    return { ok: true, count: input.events.length };
  }

  async adSummary(adId: string, ownerId: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id: adId },
      select: { id: true, ownerId: true },
    });
    if (!ad) throw new NotFoundException('AD_NOT_FOUND');
    if (ad.ownerId !== ownerId) throw new ForbiddenException();

    const aggregate = await this.aggregateAd(adId);

    return {
      adId,
      ...aggregate,
    };
  }

  async aggregateAd(adId: string) {
    const [rows, total, uniqueUsers, uniqueSessions, firstEvent, lastEvent] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['name'],
        where: { adId },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.count({ where: { adId } }),
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { adId, userId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['sessionId'],
        where: { adId, sessionId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.findFirst({
        where: { adId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.analyticsEvent.findFirst({
        where: { adId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      counts: Object.fromEntries(rows.map((row) => [row.name, row._count._all])),
      totals: {
        events: total,
        uniqueUsers: uniqueUsers.length,
        uniqueSessions: uniqueSessions.length,
      },
      window: {
        firstEventAt: firstEvent?.createdAt.toISOString() ?? null,
        lastEventAt: lastEvent?.createdAt.toISOString() ?? null,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async runDailyRollup(adIds?: string[]) {
    const ids =
      adIds ??
      (
        await this.prisma.ad.findMany({
          where: { deletedAt: null },
          select: { id: true },
        })
      ).map((ad) => ad.id);

    const summaries = await Promise.all(
      ids.map(async (adId) => {
        const aggregate = await this.aggregateAd(adId);
        await this.prisma.systemSetting.upsert({
          where: { key: `analytics:ad:${adId}` },
          create: { key: `analytics:ad:${adId}`, value: aggregate },
          update: { value: aggregate },
        });
        return { adId, ...aggregate };
      }),
    );

    return { ok: true, count: summaries.length, summaries };
  }
}
