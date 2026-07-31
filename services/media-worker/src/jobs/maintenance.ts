import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '@e3lani/database';
import { config, QUEUE_NAMES } from '../config';
import { logger } from '../lib/logger';

type MaintenanceJob = { task: 'expire-ads' | 'expire-ticker' | 'rollup-stats' | 'cleanup' };

/** إنهاء الإعلانات المنتهية وإشعار أصحابها. */
async function expireAds(): Promise<number> {
  const now = new Date();
  const expiring = await prisma.ad.findMany({
    where: { status: 'ACTIVE', expiresAt: { lte: now } },
    select: { id: true, userId: true, title: true },
    take: 500,
  });

  if (expiring.length) {
    await prisma.ad.updateMany({
      where: { id: { in: expiring.map((ad) => ad.id) } },
      data: { status: 'EXPIRED' },
    });
    await prisma.notification.createMany({
      data: expiring.map((ad) => ({
        userId: ad.userId,
        type: 'AD_EXPIRED',
        titleAr: 'انتهت مدة إعلانك',
        titleEn: 'Your ad expired',
        bodyAr: `انتهت مدة عرض «${ad.title}». يمكنك تمديده أو إعادة نشره.`,
        bodyEn: `"${ad.title}" has expired. You can extend or republish it.`,
        data: { adId: ad.id },
      })),
    });
  }

  // تنبيه قبل الانتهاء بيوم واحد
  const soon = new Date(now.getTime() + 86_400_000);
  const expiringSoon = await prisma.ad.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: now, lte: soon } },
    select: { id: true, userId: true, title: true },
    take: 500,
  });

  for (const ad of expiringSoon) {
    const alreadyWarned = await prisma.notification.findFirst({
      where: {
        userId: ad.userId,
        type: 'AD_EXPIRING_SOON',
        createdAt: { gte: new Date(now.getTime() - 86_400_000) },
        data: { path: ['adId'], equals: ad.id },
      },
      select: { id: true },
    });
    if (alreadyWarned) continue;
    await prisma.notification.create({
      data: {
        userId: ad.userId,
        type: 'AD_EXPIRING_SOON',
        titleAr: 'إعلانك على وشك الانتهاء',
        titleEn: 'Your ad expires soon',
        bodyAr: `ينتهي «${ad.title}» خلال ٢٤ ساعة.`,
        bodyEn: `"${ad.title}" expires within 24 hours.`,
        data: { adId: ad.id },
      },
    });
  }

  return expiring.length;
}

/** إنهاء شعارات الشريط المنتهية. */
async function expireTicker(): Promise<number> {
  const now = new Date();
  const expiring = await prisma.tickerRequest.findMany({
    where: { status: 'ACTIVE', endsAt: { lte: now } },
    select: { id: true, userId: true, businessName: true },
    take: 200,
  });
  if (!expiring.length) return 0;

  await prisma.tickerRequest.updateMany({
    where: { id: { in: expiring.map((row) => row.id) } },
    data: { status: 'EXPIRED' },
  });
  await prisma.notification.createMany({
    data: expiring.map((row) => ({
      userId: row.userId,
      type: 'TICKER_EXPIRED',
      titleAr: 'انتهت مدة شعارك في الشريط',
      titleEn: 'Your ticker logo expired',
      bodyAr: `انتهت مدة عرض شعار «${row.businessName}».`,
      bodyEn: `"${row.businessName}" is no longer displayed.`,
      data: { tickerRequestId: row.id },
    })),
  });
  return expiring.length;
}

/** تجميع إحصائيات الأمس في جدول التجميع اليومي. */
async function rollupStats(): Promise<number> {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 86_400_000);

  const events = await prisma.adEvent.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: {
      adId: true, type: true, deviceId: true, source: true, watchedMs: true, completed: true,
    },
  });
  if (!events.length) return 0;

  const byAd = new Map<string, any>();
  const devices = new Map<string, Set<string>>();

  for (const event of events) {
    const entry = byAd.get(event.adId) ?? {
      impressions: 0, videoViews: 0, completions: 0, totalWatchedMs: 0,
      clicksWhatsapp: 0, clicksCall: 0, clicksStore: 0, clicksLink: 0,
      saves: 0, shares: 0, organic: 0, promoted: 0,
    };

    switch (event.type) {
      case 'IMPRESSION':
        entry.impressions += 1;
        if (event.source === 'PROMOTED') entry.promoted += 1;
        else entry.organic += 1;
        break;
      case 'VIEW_START':
        entry.videoViews += 1;
        entry.totalWatchedMs += event.watchedMs ?? 0;
        break;
      case 'VIEW_COMPLETE':
        entry.completions += 1;
        entry.totalWatchedMs += event.watchedMs ?? 0;
        break;
      case 'CLICK_WHATSAPP': entry.clicksWhatsapp += 1; break;
      case 'CLICK_CALL': entry.clicksCall += 1; break;
      case 'CLICK_STORE': entry.clicksStore += 1; break;
      case 'CLICK_LINK': entry.clicksLink += 1; break;
      case 'SAVE': entry.saves += 1; break;
      case 'SHARE': entry.shares += 1; break;
      default: break;
    }

    byAd.set(event.adId, entry);
    if (!devices.has(event.adId)) devices.set(event.adId, new Set());
    devices.get(event.adId)!.add(event.deviceId);
  }

  for (const [adId, entry] of byAd) {
    await prisma.adDailyStat.upsert({
      where: { adId_date: { adId, date: start } },
      update: {
        ...entry,
        totalWatchedMs: BigInt(entry.totalWatchedMs),
        uniqueReach: devices.get(adId)?.size ?? 0,
      },
      create: {
        adId,
        date: start,
        ...entry,
        totalWatchedMs: BigInt(entry.totalWatchedMs),
        uniqueReach: devices.get(adId)?.size ?? 0,
      },
    });
  }

  return byAd.size;
}

/** تنظيف الجلسات ورموز التحقق المنتهية والأحداث القديمة. */
async function cleanupExpired(): Promise<void> {
  const now = new Date();
  await prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.adEvent.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 180 * 86_400_000) } },
  });
}

async function handle(job: Job<MaintenanceJob>): Promise<void> {
  switch (job.data.task) {
    case 'expire-ads': {
      const count = await expireAds();
      logger.info('maintenance', 'إنهاء الإعلانات المنتهية', { count });
      break;
    }
    case 'expire-ticker': {
      const count = await expireTicker();
      logger.info('maintenance', 'إنهاء شعارات الشريط', { count });
      break;
    }
    case 'rollup-stats': {
      const count = await rollupStats();
      logger.info('maintenance', 'تجميع إحصائيات الأمس', { ads: count });
      break;
    }
    case 'cleanup':
      await cleanupExpired();
      logger.info('maintenance', 'تم تنظيف السجلات المنتهية');
      break;
    default:
      break;
  }
}

export async function startMaintenance(): Promise<Worker<MaintenanceJob>> {
  const queue = new Queue<MaintenanceJob>(QUEUE_NAMES.MAINTENANCE, {
    connection: { url: config.redisUrl } as any,
  });

  // مهام دورية: انتهاء الإعلانات كل ساعة، والتجميع والتنظيف يوميًا
  await queue.add('expire-ads', { task: 'expire-ads' }, {
    repeat: { pattern: '5 * * * *' }, jobId: 'repeat:expire-ads', removeOnComplete: true,
  });
  await queue.add('expire-ticker', { task: 'expire-ticker' }, {
    repeat: { pattern: '10 * * * *' }, jobId: 'repeat:expire-ticker', removeOnComplete: true,
  });
  await queue.add('rollup-stats', { task: 'rollup-stats' }, {
    repeat: { pattern: '20 1 * * *' }, jobId: 'repeat:rollup-stats', removeOnComplete: true,
  });
  await queue.add('cleanup', { task: 'cleanup' }, {
    repeat: { pattern: '40 3 * * *' }, jobId: 'repeat:cleanup', removeOnComplete: true,
  });

  const worker = new Worker<MaintenanceJob>(QUEUE_NAMES.MAINTENANCE, handle, {
    connection: { url: config.redisUrl } as any,
    concurrency: 1,
  });

  logger.info('maintenance', 'مهام الصيانة الدورية جاهزة');
  return worker;
}

export const __testing = { expireAds, expireTicker, rollupStats, cleanupExpired };
