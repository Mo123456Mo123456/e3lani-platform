import { createWriteStream, promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import sharp from 'sharp';
import {
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';

export type InlineMediaJob = {
  assetId: string;
  storageKey: string;
  kind: 'image' | 'video';
};

export type InlineProcessResult = {
  posterKey: string;
  width?: number;
  height?: number;
  processedKeys: string[];
  mode: 'inline' | 'sandbox';
};

async function downloadToFile(client: S3Client, bucket: string, key: string, dest: string) {
  const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!obj.Body) throw new Error('EMPTY_OBJECT_BODY');
  await pipeline(obj.Body as Readable, createWriteStream(dest));
}

async function uploadBuffer(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

function processedPosterKey(storageKey: string): string {
  return storageKey.replace(/^uploads\//, 'processed/').replace(/\.[^.]+$/, '') + '/poster.jpg';
}

/**
 * Staging/sandbox media processing inside the API process.
 * Images: sharp thumbnail → R2.
 * Videos: sandbox poster (no FFmpeg on Render Free Node) → READY; source stays original.
 */
export async function processMediaInline(
  client: S3Client,
  bucket: string,
  job: InlineMediaJob,
): Promise<InlineProcessResult> {
  const workDir = await fs.mkdtemp(join(tmpdir(), 'e3lani-inline-'));
  const sourcePath = join(workDir, 'source');
  const processedKeys: string[] = [];

  try {
    const posterKey = processedPosterKey(job.storageKey);

    if (job.kind === 'image') {
      await downloadToFile(client, bucket, job.storageKey, sourcePath);
      const image = sharp(sourcePath).rotate();
      const meta = await image.metadata();
      const poster = await image
        .resize({ width: 1080, height: 1920, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      await uploadBuffer(client, bucket, posterKey, poster, 'image/jpeg');
      processedKeys.push(posterKey);
      return {
        posterKey,
        processedKeys,
        mode: 'inline',
        ...(meta.width !== undefined ? { width: meta.width } : {}),
        ...(meta.height !== undefined ? { height: meta.height } : {}),
      };
    }

    // Video sandbox: brand poster without FFmpeg (Render Free has no background worker / ffmpeg).
    const poster = await sharp({
      create: {
        width: 720,
        height: 1280,
        channels: 3,
        background: { r: 255, g: 196, b: 0 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    await uploadBuffer(client, bucket, posterKey, poster, 'image/jpeg');
    processedKeys.push(posterKey);
    return {
      posterKey,
      processedKeys,
      mode: 'sandbox',
      width: 720,
      height: 1280,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Sandbox disk storage path (Render Free without R2): read/write via local filesystem helpers.
 */
export async function processMediaInlineSandbox(
  job: InlineMediaJob,
): Promise<InlineProcessResult> {
  const { sandboxGetObject, sandboxPutObject } = await import('@e3lani/storage');
  const workDir = await fs.mkdtemp(join(tmpdir(), 'e3lani-inline-sandbox-'));
  const sourcePath = join(workDir, 'source');
  const processedKeys: string[] = [];

  try {
    const posterKey = processedPosterKey(job.storageKey);

    if (job.kind === 'image') {
      const bytes = await sandboxGetObject(job.storageKey);
      await fs.writeFile(sourcePath, bytes);
      const image = sharp(sourcePath).rotate();
      const meta = await image.metadata();
      const poster = await image
        .resize({ width: 1080, height: 1920, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      await sandboxPutObject(posterKey, poster, 'image/jpeg');
      processedKeys.push(posterKey);
      return {
        posterKey,
        processedKeys,
        mode: 'sandbox',
        ...(meta.width !== undefined ? { width: meta.width } : {}),
        ...(meta.height !== undefined ? { height: meta.height } : {}),
      };
    }

    const poster = await sharp({
      create: {
        width: 720,
        height: 1280,
        channels: 3,
        background: { r: 255, g: 196, b: 0 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    await sandboxPutObject(posterKey, poster, 'image/jpeg');
    processedKeys.push(posterKey);
    return {
      posterKey,
      processedKeys,
      mode: 'sandbox',
      width: 720,
      height: 1280,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export function shouldProcessMediaInline(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = (env.MEDIA_PROCESSING_MODE ?? '').trim().toLowerCase();
  if (mode === 'inline' || mode === 'sandbox') return true;
  if (mode === 'queue') return false;
  // Default: staging/sandbox apps process inline when no dedicated worker is deployed.
  const app = (env.APP_ENV ?? '').toLowerCase();
  return app === 'staging' || (env.OTP_MODE ?? '').toLowerCase() === 'sandbox';
}
