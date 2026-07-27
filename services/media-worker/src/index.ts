import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createStorageClient } from '@e3lani/storage';
import { processMediaJob, type MediaJob } from './processor';

const prisma = new PrismaClient();

async function main() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const bucket = process.env.S3_BUCKET ?? 'e3lani';
  const client = createStorageClient({
    endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket,
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'e3lani',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'e3lanisecret',
  });

  const redis = new Redis(redisUrl);
  // eslint-disable-next-line no-console
  console.log('E3lani media-worker listening on queue e3lani:media:jobs');

  for (;;) {
    const item = await redis.brpop('e3lani:media:jobs', 5);
    if (!item) {
      // Also drain DB-queued assets for resilience
      const queued = await prisma.mediaAsset.findMany({
        where: { status: 'QUEUED' },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });
      for (const asset of queued) {
        await handleJob(client, bucket, {
          assetId: asset.id,
          storageKey: asset.storageKey,
          kind: asset.kind === 'VIDEO' ? 'video' : 'image',
        });
      }
      continue;
    }

    const job = JSON.parse(item[1]) as MediaJob;
    await handleJob(client, bucket, job);
  }
}

async function handleJob(
  client: ReturnType<typeof createStorageClient>,
  bucket: string,
  job: MediaJob,
) {
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
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Processed ${job.assetId} → ${result.posterKey}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed ${job.assetId}`, error);
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
