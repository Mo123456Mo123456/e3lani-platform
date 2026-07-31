import { Worker, type Job } from 'bullmq';
import { prisma } from '@e3lani/database';
import { config, QUEUE_NAMES } from '../config';
import { logger } from '../lib/logger';

interface NotificationJob {
  userId: string;
  type: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data?: Record<string, unknown>;
}

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPush(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  const response = await fetch(EXPO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.push.expoAccessToken
        ? { Authorization: `Bearer ${config.push.expoAccessToken}` }
        : {}),
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`EXPO_PUSH_FAILED: ${response.status}`);
  }

  const result = (await response.json()) as { data?: { status: string; message?: string }[] };
  const invalid = (result.data ?? [])
    .map((entry, index) => (entry.status === 'error' ? tokens[index] : null))
    .filter((token): token is string => Boolean(token));

  if (invalid.length) {
    await prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
    logger.warn('push', 'تم حذف رموز دفع غير صالحة', { count: invalid.length });
  }
}

async function handle(job: Job<NotificationJob>): Promise<void> {
  if (config.push.provider === 'none') return;

  const user = await prisma.user.findUnique({
    where: { id: job.data.userId },
    select: { locale: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: job.data.userId },
    select: { token: true },
  });
  if (!tokens.length) return;

  const isArabic = (user.locale ?? 'ar') === 'ar';
  await sendExpoPush(
    tokens.map((row) => row.token),
    {
      title: isArabic ? job.data.titleAr : job.data.titleEn,
      body: isArabic ? job.data.bodyAr : job.data.bodyEn,
      data: { type: job.data.type, ...(job.data.data ?? {}) },
    },
  );
}

export function startNotificationsWorker(): Worker<NotificationJob> {
  const worker = new Worker<NotificationJob>(QUEUE_NAMES.NOTIFICATIONS, handle, {
    connection: { url: config.redisUrl } as any,
    concurrency: 5,
  });

  worker.on('failed', (job, error) => {
    logger.warn('push', 'تعذّر إرسال إشعار', { jobId: job?.id, error: error.message });
  });

  logger.info('push', 'عامل الإشعارات جاهز', { provider: config.push.provider });
  return worker;
}
