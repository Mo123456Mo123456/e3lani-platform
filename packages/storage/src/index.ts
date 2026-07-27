import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
};

export type SignedUpload = {
  assetKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export function createStorageClient(config: StorageConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function buildObjectKey(input: {
  ownerId: string;
  kind: 'image' | 'video';
  mimeType: string;
}): string {
  const ext =
    input.mimeType === 'image/png'
      ? 'png'
      : input.mimeType === 'image/webp'
        ? 'webp'
        : input.mimeType === 'video/quicktime'
          ? 'mov'
          : input.kind === 'video'
            ? 'mp4'
            : 'jpg';
  const day = new Date().toISOString().slice(0, 10);
  return `uploads/${day}/${input.ownerId}/${input.kind}/${randomUUID()}.${ext}`;
}

export async function ensureBucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function createSignedUpload(
  client: S3Client,
  input: { bucket: string; key: string; mimeType: string; expiresInSeconds?: number },
): Promise<SignedUpload> {
  const expiresInSeconds = input.expiresInSeconds ?? 900;
  const command = new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.mimeType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return {
    assetKey: input.key,
    uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': input.mimeType },
    expiresInSeconds,
  };
}

export async function objectExists(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string }> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      exists: true,
      ...(head.ContentLength !== undefined ? { sizeBytes: head.ContentLength } : {}),
      ...(head.ContentType ? { contentType: head.ContentType } : {}),
    };
  } catch {
    return { exists: false };
  }
}

export async function createSignedDownload(
  client: S3Client,
  input: { bucket: string; key: string; expiresInSeconds?: number },
): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
    { expiresIn: input.expiresInSeconds ?? 3600 },
  );
}

export function assertAllowedStorageKey(key: string): void {
  if (!key.startsWith('uploads/') && !key.startsWith('processed/')) {
    throw new Error('STORAGE_KEY_NOT_ALLOWED');
  }
  if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new Error('STORAGE_KEY_INVALID');
  }
}

export function fingerprintBody(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

export { PutObjectCommand, GetObjectCommand };
