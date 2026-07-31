import { createWriteStream } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config';

const client = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  forcePathStyle: config.s3.forcePathStyle,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

export async function downloadToTemp(key: string, extension: string): Promise<string> {
  const target = join(tmpdir(), `e3lani-${randomUUID()}.${extension}`);
  const result = await client.send(
    new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }),
  );
  await pipeline(result.Body as Readable, createWriteStream(target));
  return target;
}

export async function uploadFile(key: string, path: string, contentType: string): Promise<void> {
  const body = await readFile(path);
  await client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

export async function uploadBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key })).catch(() => undefined);
}

export async function cleanup(...paths: (string | null | undefined)[]): Promise<void> {
  await Promise.all(
    paths.filter(Boolean).map((path) => unlink(path as string).catch(() => undefined)),
  );
}

export { replaceExtension } from './media-rules';
