import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';
import {
  isSandboxStorageRequested,
  resolveStorageEnv,
  storageHealthSummary,
  type StorageConfig,
  type StorageEnvStatus,
  type StorageProviderName,
} from './env';
import {
  apiPublicBaseUrl,
  checkSandboxStorageHealth,
  createSandboxSignedDownload,
  createSandboxSignedUpload,
  sandboxDeleteObject,
  sandboxEnsureRoot,
  sandboxGetObject,
  sandboxHeadObject,
  sandboxPutObject,
  sandboxRoot,
  verifySandboxDownloadSig,
  verifySandboxUploadSig,
  type SandboxSignedUpload,
} from './sandbox';

export type { StorageConfig, StorageEnvStatus, StorageProviderName, SandboxSignedUpload };
export {
  resolveStorageEnv,
  storageHealthSummary,
  isSandboxStorageRequested,
  apiPublicBaseUrl,
  checkSandboxStorageHealth,
  createSandboxSignedDownload,
  createSandboxSignedUpload,
  sandboxDeleteObject,
  sandboxEnsureRoot,
  sandboxGetObject,
  sandboxHeadObject,
  sandboxPutObject,
  sandboxRoot,
  verifySandboxDownloadSig,
  verifySandboxUploadSig,
};

export type SignedUpload = {
  assetKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export type StorageHealthResult = {
  healthy: boolean;
  configured: boolean;
  misconfigured: boolean;
  provider: StorageProviderName;
  message: string;
  missing: string[];
  bucket?: string;
  endpointHost?: string;
  privateBucket: boolean;
  checkedAt: string;
};

export type CreateStorageClientInput = Pick<
  StorageConfig,
  'endpoint' | 'region' | 'bucket' | 'accessKeyId' | 'secretAccessKey'
> &
  Partial<Pick<StorageConfig, 'forcePathStyle' | 'provider' | 'privateBucket' | 'publicBaseUrl'>>;

export function createStorageClient(config: CreateStorageClientInput): S3Client {
  const forcePathStyle =
    config.forcePathStyle ??
    (config.provider === 'r2' ? false : true);
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/** Build S3/R2 client from env; returns null for sandbox or when unconfigured. */
export function createStorageClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): { client: S3Client; config: StorageConfig; status: StorageEnvStatus } | null {
  const status = resolveStorageEnv(env);
  if (!status.configured || !status.config || status.provider === 'sandbox') return null;
  return {
    client: createStorageClient(status.config),
    config: status.config,
    status,
  };
}

export function buildObjectKey(input: {
  ownerId: string;
  kind: 'image' | 'video';
  mimeType: string;
}): string {
  const mime = input.mimeType.toLowerCase();
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : mime === 'video/quicktime'
          ? 'mov'
          : input.kind === 'video'
            ? 'mp4'
            : 'jpg';
  const day = new Date().toISOString().slice(0, 10);
  // Server-generated key only — never trust client filename.
  return `uploads/${day}/${input.ownerId}/${input.kind}/${randomUUID()}.${ext}`;
}

export async function ensureBucket(
  client: S3Client,
  bucket: string,
  options?: { provider?: StorageProviderName; createIfMissing?: boolean },
): Promise<void> {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  // R2 buckets are provisioned in the Cloudflare dashboard — do not auto-create.
  if (options?.provider === 'r2') return;
  if (options?.createIfMissing === false) return;
}

export async function ensureBucketOrCreate(
  client: S3Client,
  bucket: string,
  provider: StorageProviderName = 'unknown',
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    if (provider === 'r2') {
      throw new Error('R2_BUCKET_NOT_FOUND');
    }
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

export async function deleteObject(
  client: S3Client,
  input: { bucket: string; key: string },
): Promise<void> {
  assertAllowedStorageKey(input.key);
  await client.send(
    new DeleteObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    }),
  );
}

export async function checkStorageHealth(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StorageHealthResult> {
  const status = resolveStorageEnv(env);
  const base: Omit<StorageHealthResult, 'healthy' | 'message'> = {
    configured: status.configured,
    misconfigured: status.misconfigured,
    provider: status.provider,
    missing: status.missing,
    privateBucket: status.privateBucket,
    checkedAt: new Date().toISOString(),
  };
  if (status.bucket) base.bucket = status.bucket;
  if (status.endpointHost) base.endpointHost = status.endpointHost;

  if (status.provider === 'sandbox' && status.configured) {
    const probe = await checkSandboxStorageHealth();
    return {
      ...base,
      healthy: probe.healthy,
      message: probe.message,
      bucket: 'sandbox',
    };
  }

  if (!status.configured || !status.config) {
    return {
      ...base,
      healthy: false,
      message: status.misconfigured
        ? `STORAGE_MISCONFIGURED: missing ${status.missing.join(', ')}`
        : 'STORAGE_NOT_CONFIGURED',
    };
  }

  try {
    const client = createStorageClient(status.config);
    await client.send(new HeadBucketCommand({ Bucket: status.config.bucket }));
    return {
      ...base,
      healthy: true,
      message: `storage ok (${status.provider})`,
    };
  } catch (error) {
    const errName = error instanceof Error ? error.name : 'Error';
    return {
      ...base,
      healthy: false,
      message: `STORAGE_UNREACHABLE: ${errName}`,
    };
  }
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

export function publicObjectUrl(storageKey: string, publicBaseUrl: string): string {
  const base = publicBaseUrl.replace(/\/$/, '');
  return `${base}/${storageKey.replace(/^\//, '')}`;
}

export { PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
