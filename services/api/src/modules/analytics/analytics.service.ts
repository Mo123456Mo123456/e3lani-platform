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

    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['name'],
      where: { adId },
      _count: { _all: true },
    });

    return {
      adId,
      counts: Object.fromEntries(rows.map((row) => [row.name, row._count._all])),
    };
  }
}
