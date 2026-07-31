import { prisma } from '@e3lani/database';
import { config } from './config';
import { logger } from './lib/logger';
import { startMediaWorker } from './processors/media.worker';
import { startNotificationsWorker } from './processors/notifications.worker';
import { startMaintenance } from './jobs/maintenance';

async function main(): Promise<void> {
  logger.info('boot', 'بدء تشغيل عامل الوسائط لمنصة إعلاني', { env: config.nodeEnv });

  await prisma.$connect();

  const workers = [startMediaWorker(), startNotificationsWorker(), await startMaintenance()];

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('boot', 'إيقاف العامل', { signal });
    await Promise.all(workers.map((worker) => worker.close().catch(() => undefined)));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error('boot', 'فشل تشغيل العامل', { error: (error as Error).message });
  process.exit(1);
});
