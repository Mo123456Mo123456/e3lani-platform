import { Worker, type Job } from 'bullmq';
import { prisma } from '@e3lani/database';
import { config, QUEUE_NAMES } from '../config';
import { cleanup, downloadToTemp } from '../lib/storage';
import { logger } from '../lib/logger';
import { failureCode, messageFor, shouldRetry } from '../lib/media-rules';
import { processImage } from './image.processor';
import { processVideo } from './video.processor';

interface MediaJob {
  mediaId: string;
  key: string;
  type: 'IMAGE' | 'VIDEO';
  purpose: string;
}


async function handle(job: Job<MediaJob>): Promise<void> {
  const { mediaId, key, type } = job.data;
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!media) {
    logger.warn('media', 'الوسيط غير موجود، تم تجاهل المهمة', { mediaId });
    return;
  }
  if (media.status === 'READY') return;

  const extension = key.split('.').pop() ?? (type === 'IMAGE' ? 'jpg' : 'mp4');
  let sourcePath: string | null = null;

  try {
    sourcePath = await downloadToTemp(key, extension);

    if (type === 'IMAGE') {
      const result = await processImage(sourcePath, key);
      await prisma.mediaAsset.update({
        where: { id: mediaId },
        data: {
          status: 'READY',
          playbackKey: result.playbackKey,
          thumbnailKey: result.thumbnailKey,
          variants: result.variants as any,
          width: result.width,
          height: result.height,
          sizeBytes: result.sizeBytes || media.sizeBytes,
          blurhash: result.placeholder,
          mimeType: 'image/webp',
          processedAt: new Date(),
          error: null,
        },
      });
    } else {
      const result = await processVideo(sourcePath, key);
      await prisma.mediaAsset.update({
        where: { id: mediaId },
        data: {
          status: 'READY',
          playbackKey: result.playbackKey,
          thumbnailKey: result.thumbnailKey,
          variants: result.variants as any,
          width: result.width,
          height: result.height,
          durationMs: result.durationMs,
          sizeBytes: result.sizeBytes || media.sizeBytes,
          mimeType: 'video/mp4',
          processedAt: new Date(),
          error: null,
        },
      });
    }

    logger.info('media', 'اكتملت معالجة الوسيط', { mediaId, type });
  } catch (error) {
    const code = failureCode((error as Error).message);
    const attemptsMade = job.attemptsMade + 1;

    if (!shouldRetry(code, attemptsMade, job.opts.attempts ?? 3)) {
      await markFailed(mediaId, code);
      logger.error('media', 'فشلت معالجة الوسيط نهائيًا', { mediaId, code });
      return; // لا نعيد المحاولة على أخطاء التحقق
    }

    logger.warn('media', 'فشلت المحاولة، ستُعاد', { mediaId, code, attemptsMade });
    throw error;
  } finally {
    await cleanup(sourcePath);
  }
}

/**
 * عند فشل الفحص الآلي للوسيط، أي إعلان مرتبط به يُرفض تلقائيًا مع إشعار صاحبه.
 * هذا فحص آلي بالكامل ولا يتضمن أي مراجعة بشرية.
 */
async function markFailed(mediaId: string, code: string): Promise<void> {
  const message = messageFor(code);

  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: { status: 'FAILED', error: code },
  });

  const links = await prisma.adMedia.findMany({
    where: { mediaId },
    include: { ad: { select: { id: true, userId: true, title: true, status: true } } },
  });

  for (const link of links) {
    if (['REMOVED', 'REJECTED'].includes(link.ad.status)) continue;
    await prisma.ad.update({
      where: { id: link.ad.id },
      data: { status: 'REJECTED', rejectionReason: message.ar },
    });
    await prisma.notification.create({
      data: {
        userId: link.ad.userId,
        type: 'AD_REJECTED',
        titleAr: 'لم يجتز الإعلان الفحص الآلي',
        titleEn: 'Ad failed the automated check',
        bodyAr: `${message.ar} — عدّل الملف وأعد النشر.`,
        bodyEn: `${message.en} — please fix the file and republish.`,
        data: { adId: link.ad.id, code },
      },
    });
  }

  const postLinks = await prisma.postMedia.findMany({
    where: { mediaId },
    include: { post: { select: { id: true, userId: true } } },
  });
  for (const link of postLinks) {
    await prisma.post.update({
      where: { id: link.post.id },
      data: { isActive: false, removalReason: message.ar, removedAt: new Date() },
    });
  }
}

export function startMediaWorker(): Worker<MediaJob> {
  const worker = new Worker<MediaJob>(QUEUE_NAMES.MEDIA, handle, {
    connection: { url: config.redisUrl } as any,
    concurrency: config.concurrency,
  });

  worker.on('failed', (job, error) => {
    logger.error('media', 'فشلت المهمة', { jobId: job?.id, error: error.message });
  });

  logger.info('media', 'عامل معالجة الوسائط جاهز', { concurrency: config.concurrency });
  return worker;
}
