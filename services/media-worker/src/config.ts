import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

for (const candidate of ['../../.env', '../.env', '.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    loadEnv({ path });
    break;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`متغيّر البيئة ${name} مفقود`);
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  redisUrl: required('REDIS_URL'),
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'e3lani-media',
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  },
  media: {
    maxVideoSeconds: Number(process.env.MEDIA_MAX_VIDEO_SECONDS ?? 60),
    maxImageBytes: Number(process.env.MEDIA_MAX_IMAGE_BYTES ?? 10 * 1024 * 1024),
    maxVideoBytes: Number(process.env.MEDIA_MAX_VIDEO_BYTES ?? 100 * 1024 * 1024),
  },
  push: {
    provider: process.env.PUSH_PROVIDER ?? 'expo',
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
  },
} as const;

export const QUEUE_NAMES = {
  MEDIA: 'e3lani-media',
  NOTIFICATIONS: 'e3lani-notifications',
  MAINTENANCE: 'e3lani-maintenance',
} as const;
