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

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function inferProvider(endpoint: string | undefined, explicit?: string): StorageProviderName {
  const named = explicit?.trim().toLowerCase();
  if (named === 'r2' || named === 'minio' || named === 's3') return named;
  if (!endpoint) return 'unknown';
  if (endpoint.includes('r2.cloudflarestorage.com') || endpoint.includes('.r2.dev')) return 'r2';
  if (endpoint.includes('amazonaws.com')) return 's3';
  if (/localhost|127\.0\.0\.1|:9000/.test(endpoint)) return 'minio';
  return 'unknown';
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
 * Resolve S3-compatible storage env (Cloudflare R2 / MinIO / S3).
 * Prefer AWS-style names; accept legacy S3_ACCESS_KEY / S3_SECRET_KEY.
 * Never log secret values from this helper.
 */
export function resolveStorageEnv(env: NodeJS.ProcessEnv = process.env): StorageEnvStatus {
  const checkedAt = new Date().toISOString();
  const endpoint = trim(env.S3_ENDPOINT);
  const bucket = trim(env.S3_BUCKET);
  const region = trim(env.S3_REGION) ?? 'auto';
  const accessKeyId = trim(env.S3_ACCESS_KEY_ID) ?? trim(env.S3_ACCESS_KEY);
  const secretAccessKey = trim(env.S3_SECRET_ACCESS_KEY) ?? trim(env.S3_SECRET_KEY);
  const publicBaseUrl = trim(env.S3_PUBLIC_BASE_URL);
  const provider = inferProvider(endpoint, env.STORAGE_PROVIDER);
  const forcePathStyle = parseBool(
    env.S3_FORCE_PATH_STYLE,
    provider === 'r2' ? false : true,
  );

  const missing: string[] = [];
  if (!endpoint) missing.push('S3_ENDPOINT');
  if (!bucket) missing.push('S3_BUCKET');
  if (!accessKeyId) missing.push('S3_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');

  const anyStorageHint = Boolean(
    endpoint ||
      bucket ||
      accessKeyId ||
      secretAccessKey ||
      publicBaseUrl ||
      trim(env.STORAGE_PROVIDER),
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
      provider,
      privateBucket: !publicBaseUrl,
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
    provider,
    privateBucket: !publicBaseUrl,
  };
  if (publicBaseUrl) config.publicBaseUrl = publicBaseUrl;

  return withHost(
    {
      configured: true,
      misconfigured: false,
      missing: [],
      provider,
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
