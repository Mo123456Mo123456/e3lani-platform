import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('validates and inserts event batches', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      analyticsEvent: { createMany },
    } as unknown as PrismaService;
    const service = new AnalyticsService(prisma);

    await expect(
      service.recordEvents({
        events: [
          {
            name: 'ad.view',
            adId: '11111111-1111-4111-8111-111111111111',
            sessionId: 'session-1',
            platform: 'web',
            locale: 'en',
            payload: { source: 'test' },
          },
        ],
      }),
    ).resolves.toEqual({ ok: true, count: 1 });

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          name: 'ad.view',
          adId: '11111111-1111-4111-8111-111111111111',
          userId: undefined,
          sessionId: 'session-1',
          platform: 'web',
          locale: 'en',
          payload: { source: 'test' },
        },
      ],
    });
  });

  it('rejects batches over 50 events', async () => {
    const prisma = {
      analyticsEvent: { createMany: vi.fn() },
    } as unknown as PrismaService;
    const service = new AnalyticsService(prisma);

    await expect(
      service.recordEvents({
        events: Array.from({ length: 51 }, (_, index) => ({ name: `event.${index}` })),
      }),
    ).rejects.toThrow();
  });
});
