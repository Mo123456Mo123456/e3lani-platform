import { spawn } from 'child_process';
import { createWriteStream, promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import sharp from 'sharp';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export type MediaJob = {
  assetId: string;
  storageKey: string;
  kind: 'image' | 'video';
};

export type ProcessResult = {
  posterKey: string;
  width?: number;
  height?: number;
  processedKeys: string[];
};

async function downloadToFile(client: S3Client, bucket: string, key: string, dest: string) {
  const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!obj.Body) throw new Error('EMPTY_OBJECT_BODY');
  const body = obj.Body as Readable;
  await pipeline(body, createWriteStream(dest));
}

async function uploadFile(
  client: S3Client,
  bucket: string,
  key: string,
  filePath: string,
  contentType: string,
) {
  const body = await fs.readFile(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-500)}`));
    });
  });
}

export async function processMediaJob(
  client: S3Client,
  bucket: string,
  job: MediaJob,
): Promise<ProcessResult> {
  const workDir = await fs.mkdtemp(join(tmpdir(), 'e3lani-media-'));
  const sourcePath = join(workDir, 'source');
  const posterPath = join(workDir, 'poster.jpg');
  const processedKeys: string[] = [];

  try {
    await downloadToFile(client, bucket, job.storageKey, sourcePath);
    let width: number | undefined;
    let height: number | undefined;

    if (job.kind === 'image') {
      const image = sharp(sourcePath).rotate();
      const meta = await image.metadata();
      width = meta.width;
      height = meta.height;
      await image
        .resize({ width: 1080, height: 1920, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(posterPath);

      const thumbKey = job.storageKey.replace(/^uploads\//, 'processed/').replace(/\.[^.]+$/, '') + '/poster.jpg';
      await uploadFile(client, bucket, thumbKey, posterPath, 'image/jpeg');
      processedKeys.push(thumbKey);
      return {
        posterKey: thumbKey,
        processedKeys,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      };
    }

    // Video: extract poster + create 720p progressive MP4 when ffmpeg is available
    await runFfmpeg(['-i', sourcePath, '-ss', '00:00:00.5', '-vframes', '1', posterPath]);
    const posterMeta = await sharp(posterPath).metadata();
    width = posterMeta.width;
    height = posterMeta.height;

    const base = job.storageKey.replace(/^uploads\//, 'processed/').replace(/\.[^.]+$/, '');
    const posterKey = `${base}/poster.jpg`;
    await uploadFile(client, bucket, posterKey, posterPath, 'image/jpeg');
    processedKeys.push(posterKey);

    const out720 = join(workDir, 'out-720.mp4');
    await runFfmpeg([
      '-i',
      sourcePath,
      '-vf',
      'scale=-2:720',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      out720,
    ]);
    const key720 = `${base}/720p.mp4`;
    await uploadFile(client, bucket, key720, out720, 'video/mp4');
    processedKeys.push(key720);

    return {
      posterKey,
      processedKeys,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export function planRenditions(kind: MediaJob['kind']): string[] {
  if (kind === 'image') return ['poster'];
  return ['poster', '720p'];
}

export function assertNoClientControlledUrl(url: string, allowedHosts: string[]): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid media URL');
  }
  if (!allowedHosts.includes(parsed.host)) {
    throw new Error('Media URL host is not allowed');
  }
}
