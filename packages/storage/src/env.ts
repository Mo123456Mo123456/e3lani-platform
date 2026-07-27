export type StorageProviderName = 'r2' | 'minio' | 's3' | 'unknown';

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
  provider: StorageProviderName;
  /** When true, prefer signed GET URLs over public base URL assembly. */
  privateBucket: boolean;
};

export type StorageEnvStatus = {
  configured: boolean;
  /** Partial config present but missing required fields — never treat as healthy. */
  misconfigured: boolean;
  missing: string[];
  provider: StorageProviderName;
  bucket?: string;
  endpointHost?: string;
  privateBucket: boolean;
  forcePathStyle: boolean;
  mode: 'configured' | 'unconfigured' | 'dev-defaults' | 'misconfigured';
  config?: StorageConfig;
  checkedAt: string;
};

/** Canonical env names for Cloudflare R2 (no legacy S3_* aliases). */
export const R2_ENV_KEYS = [
  'R2_ENDPOINT',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const;

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function endpointHost(endpoint: string): string | undefined {
  try {
    return new URL(endpoint).host;
  } catch {
    return undefined;
  }
}

function isProdLike(env: NodeJS.ProcessEnv): boolean {
  const nodeEnv = (env.NODE_ENV ?? '').toLowerCase();
  const app = (env.APP_ENV ?? '').toLowerCase();
  return nodeEnv === 'production' || app === 'staging' || app === 'production';
}

function withHost(status: StorageEnvStatus, host: string | undefined): StorageEnvStatus {
  if (host) status.endpointHost = host;
  return status;
}

/**
 * Resolve object-storage env using R2_* names only.
 * AWS SDK settings for R2 are fixed: region=auto, forcePathStyle=false.
 * Never log secret values from this helper.
 */
export function resolveStorageEnv(env: NodeJS.ProcessEnv = process.env): StorageEnvStatus {
  const checkedAt = new Date().toISOString();
  const endpoint = trim(env.R2_ENDPOINT);
  const bucket = trim(env.R2_BUCKET);
  const accessKeyId = trim(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = trim(env.R2_SECRET_ACCESS_KEY);
  const providerHint = trim(env.STORAGE_PROVIDER)?.toLowerCase();
  const provider: StorageProviderName =
    providerHint === 'r2' || providerHint === 'minio' || providerHint === 's3'
      ? providerHint
      : endpoint?.includes('r2.cloudflarestorage.com') || endpoint?.includes('.r2.dev')
        ? 'r2'
        : endpoint && /localhost|127\.0\.0\.1|:9000/.test(endpoint)
          ? 'minio'
          : endpoint
            ? 'unknown'
            : 'unknown';

  // R2 (and staging) always use these AWS SDK options internally.
  const region = 'auto';
  const forcePathStyle = false;

  const missing: string[] = [];
  if (!endpoint) missing.push('R2_ENDPOINT');
  if (!bucket) missing.push('R2_BUCKET');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');

  const anyStorageHint = Boolean(
    endpoint ||
      bucket ||
      accessKeyId ||
      secretAccessKey ||
      providerHint,
  );

  // Local DX: MinIO defaults only outside prod/staging and only when nothing is set.
  if (missing.length > 0 && !isProdLike(env) && !anyStorageHint) {
    const config: StorageConfig = {
      endpoint: 'http://127.0.0.1:9000',
      region: 'us-east-1',
      bucket: 'e3lani',
      accessKeyId: 'e3lani',
      secretAccessKey: 'e3lanisecret',
      publicBaseUrl: 'http://127.0.0.1:9000/e3lani',
      forcePathStyle: true,
      provider: 'minio',
      privateBucket: false,
    };
    return withHost(
      {
        configured: true,
        misconfigured: false,
        missing: [],
        provider: 'minio',
        bucket: config.bucket,
        privateBucket: false,
        forcePathStyle: true,
        mode: 'dev-defaults',
        config,
        checkedAt,
      },
      endpointHost(config.endpoint),
    );
  }

  if (missing.length > 0) {
    const status: StorageEnvStatus = {
      configured: false,
      misconfigured: anyStorageHint,
      missing,
      provider: providerHint === 'r2' || provider === 'r2' ? 'r2' : provider,
      privateBucket: true,
      forcePathStyle,
      mode: anyStorageHint ? 'misconfigured' : 'unconfigured',
      checkedAt,
    };
    if (bucket) status.bucket = bucket;
    return withHost(status, endpoint ? endpointHost(endpoint) : undefined);
  }

  const config: StorageConfig = {
    endpoint: endpoint!,
    region,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    forcePathStyle,
    provider: providerHint === 'r2' ? 'r2' : provider === 'unknown' ? 'r2' : provider,
    privateBucket: true,
  };

  return withHost(
    {
      configured: true,
      misconfigured: false,
      missing: [],
      provider: config.provider,
      bucket: config.bucket,
      privateBucket: config.privateBucket,
      forcePathStyle: config.forcePathStyle,
      mode: 'configured',
      config,
      checkedAt,
    },
    endpointHost(config.endpoint),
  );
}

/** Public summary safe for /health (no secrets, no full endpoint). */
export function storageHealthSummary(status: StorageEnvStatus = resolveStorageEnv()) {
  return {
    configured: status.configured,
    misconfigured: status.misconfigured,
    provider: status.provider,
    mode: status.mode,
    missing: status.missing,
    bucket: status.bucket,
    endpointHost: status.endpointHost,
    privateBucket: status.privateBucket,
    forcePathStyle: status.forcePathStyle,
    checkedAt: status.checkedAt,
  };
}
