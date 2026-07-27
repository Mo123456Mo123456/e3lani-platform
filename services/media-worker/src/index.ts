import type { S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createStorageClientFromEnv, resolveStorageEnv } from '@e3lani/storage';
import { processMediaJob, type MediaJob } from './processor';

const prisma = new PrismaClient();

async function main() {
  const status = resolveStorageEnv();
  if (!status.configured || !status.config) {
    console.error(
      `STORAGE_NOT_CONFIGURED missing=${status.missing.join(',') || 'none'} — media-worker refuses to start with fake success`,
    );
    process.exit(1);
  }

  const resolved = createStorageClientFromEnv();
  if (!resolved) {
    console.error('STORAGE_NOT_CONFIGURED');
    process.exit(1);
  }

  const { client, config } = resolved;
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const redis = new Redis(redisUrl);

  // eslint-disable-next-line no-console
  console.log(
    `E3lani media-worker listening provider=${config.provider} bucket=${config.bucket} private=${config.privateBucket}`,
  );

  for (;;) {
    const item = await redis.brpop('e3lani:media:jobs', 5);
    if (!item) {
      const queued = await prisma.mediaAsset.findMany({
        where: { status: 'QUEUED' },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });
      for (const asset of queued) {
        await handleJob(client, config.bucket, {
          assetId: asset.id,
          storageKey: asset.storageKey,
          kind: asset.kind === 'VIDEO' ? 'video' : 'image',
        });
      }
      continue;
    }

    const job = JSON.parse(item[1]) as MediaJob;
    await handleJob(client, config.bucket, job);
  }
}

async function handleJob(client: S3Client, bucket: string, job: MediaJob) {
  try {
    await prisma.mediaAsset.update({
      where: { id: job.assetId },
      data: { status: 'PROCESSING' },
    });
    const result = await processMediaJob(client, bucket, job);
    await prisma.mediaAsset.update({
      where: { id: job.assetId },
      data: {
        status: 'READY',
        posterKey: result.posterKey,
        ...(result.width !== undefined ? { width: result.width } : {}),
        ...(result.height !== undefined ? { height: result.height } : {}),
        ...(result.durationSec !== undefined ? { durationSec: result.durationSec } : {}),
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Processed ${job.assetId} → READY ${result.posterKey}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed ${job.assetId}`, error instanceof Error ? error.message : error);
    await prisma.mediaAsset.update({
      where: { id: job.assetId },
      data: { status: 'FAILED' },
    });
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
}

export { planRenditions, assertNoClientControlledUrl } from './processor';
