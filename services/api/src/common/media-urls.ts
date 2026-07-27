import {
  createSandboxSignedDownload,
  createSignedDownload,
  createStorageClientFromEnv,
  isSandboxStorageRequested,
  publicObjectUrl as joinPublicUrl,
  resolveStorageEnv,
  type CreateStorageClientInput,
} from '@e3lani/storage';
import type { S3Client } from '@aws-sdk/client-s3';

export type StorageBinding =
  | { sandbox: true }
  | {
      client: S3Client;
      config: CreateStorageClientInput & { privateBucket?: boolean; publicBaseUrl?: string };
    }
  | null;

function defaultStorageBinding(): StorageBinding {
  if (isSandboxStorageRequested()) {
    return { sandbox: true };
  }
  const resolved = createStorageClientFromEnv();
  if (!resolved) return null;
  return { client: resolved.client, config: resolved.config };
}

export function publicObjectUrl(storageKey: string): string {
  if (isSandboxStorageRequested()) {
    return createSandboxSignedDownload({ key: storageKey });
  }
  const base = (process.env.R2_PUBLIC_BASE_URL ?? 'http://127.0.0.1:9000/e3lani').replace(
    /\/$/,
    '',
  );
  return joinPublicUrl(storageKey, base);
}

function processed720Key(storageKey: string): string {
  return (
    storageKey.replace(/^uploads\//, 'processed/').replace(/\.[^.]+$/, '') + '/720p.mp4'
  );
}

export async function resolveObjectUrl(input: {
  storageKey: string;
  client?: S3Client | null;
  bucket?: string;
  publicBaseUrl?: string;
  privateBucket?: boolean;
  expiresInSeconds?: number;
  sandbox?: boolean;
}): Promise<string> {
  if (input.sandbox || isSandboxStorageRequested()) {
    return createSandboxSignedDownload({
      key: input.storageKey,
      expiresInSeconds: input.expiresInSeconds ?? 3600,
    });
  }

  const useSigned =
    Boolean(input.privateBucket) ||
    !input.publicBaseUrl ||
    process.env.STORAGE_SIGN_READ_URLS === 'true';

  if (useSigned && input.client && input.bucket) {
    return createSignedDownload(input.client, {
      bucket: input.bucket,
      key: input.storageKey,
      expiresInSeconds: input.expiresInSeconds ?? 3600,
    });
  }

  if (input.publicBaseUrl) {
    return joinPublicUrl(input.storageKey, input.publicBaseUrl);
  }
  return publicObjectUrl(input.storageKey);
}

export async function decorateAsset<
  T extends {
    storageKey: string;
    posterKey?: string | null;
    status: string;
    kind: string;
  },
>(asset: T, storage?: StorageBinding) {
  const binding = storage === undefined ? defaultStorageBinding() : storage;

  if (binding && 'sandbox' in binding && binding.sandbox) {
    const sourceUrl = await resolveObjectUrl({ storageKey: asset.storageKey, sandbox: true });
    const posterUrl = asset.posterKey
      ? await resolveObjectUrl({ storageKey: asset.posterKey, sandbox: true })
      : null;
    // Sandbox (and Free-tier inline) keeps original video; no 720p transcode.
    let playbackUrl: string | null = null;
    if (asset.status === 'READY') {
      playbackUrl = sourceUrl;
    }
    return {
      ...asset,
      urls: {
        source: sourceUrl,
        poster: posterUrl,
        playback: playbackUrl ?? posterUrl ?? sourceUrl,
      },
    };
  }

  const ctx =
    binding && 'client' in binding
      ? {
          client: binding.client,
          bucket: binding.config.bucket,
          publicBaseUrl: binding.config.publicBaseUrl,
          privateBucket: binding.config.privateBucket ?? !binding.config.publicBaseUrl,
        }
      : undefined;

  const sourceUrl = ctx
    ? await resolveObjectUrl({ storageKey: asset.storageKey, ...ctx })
    : publicObjectUrl(asset.storageKey);

  const posterUrl = asset.posterKey
    ? ctx
      ? await resolveObjectUrl({ storageKey: asset.posterKey, ...ctx })
      : publicObjectUrl(asset.posterKey)
    : null;

  let playbackUrl: string | null = null;
  if (asset.status === 'READY') {
    if (asset.kind === 'VIDEO') {
      const key720 = processed720Key(asset.storageKey);
      playbackUrl = ctx
        ? await resolveObjectUrl({ storageKey: key720, ...ctx })
        : publicObjectUrl(key720);
    } else {
      playbackUrl = sourceUrl;
    }
  }

  return {
    ...asset,
    urls: {
      source: sourceUrl,
      poster: posterUrl,
      playback: playbackUrl ?? posterUrl ?? sourceUrl,
    },
  };
}

export async function decorateAdMedia<
  T extends { asset: Parameters<typeof decorateAsset>[0] },
>(media: T[], storage?: Parameters<typeof decorateAsset>[1]) {
  return Promise.all(
    media.map(async (item) => ({
      ...item,
      asset: await decorateAsset(item.asset, storage),
    })),
  );
}

/** Prefer env resolution for callers that only need provider awareness. */
export function currentStorageProvider() {
  return resolveStorageEnv().provider;
}
