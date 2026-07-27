import { describe, expect, it } from 'vitest';
import {
  assertAllowedStorageKey,
  buildObjectKey,
  createStorageClient,
  resolveStorageEnv,
  storageHealthSummary,
} from './index';

describe('storage keys', () => {
  it('builds upload keys under uploads/ without client filenames', () => {
    const key = buildObjectKey({
      ownerId: 'user-1',
      kind: 'image',
      mimeType: 'image/jpeg',
    });
    expect(key.startsWith('uploads/')).toBe(true);
    expect(key.includes('/image/')).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
    expect(key.includes('..')).toBe(false);
  });

  it('rejects client-controlled traversal keys', () => {
    expect(() => assertAllowedStorageKey('../etc/passwd')).toThrow(/NOT_ALLOWED|INVALID/);
    expect(() => assertAllowedStorageKey('uploads/../secret')).toThrow(/INVALID/);
  });
});

describe('resolveStorageEnv', () => {
  it('reads R2_* names only and forces region=auto forcePathStyle=false', () => {
    const status = resolveStorageEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      STORAGE_PROVIDER: 'r2',
      R2_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
      R2_BUCKET: 'e3lani-media',
      R2_ACCESS_KEY_ID: 'key-id',
      R2_SECRET_ACCESS_KEY: 'secret',
    } as NodeJS.ProcessEnv);

    expect(status.configured).toBe(true);
    expect(status.misconfigured).toBe(false);
    expect(status.provider).toBe('r2');
    expect(status.config?.region).toBe('auto');
    expect(status.config?.forcePathStyle).toBe(false);
    expect(status.privateBucket).toBe(true);
    expect(status.config?.accessKeyId).toBe('key-id');
  });

  it('ignores legacy S3_* names', () => {
    const status = resolveStorageEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      STORAGE_PROVIDER: 'r2',
      S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
      S3_BUCKET: 'e3lani',
      S3_ACCESS_KEY_ID: 'legacy-key',
      S3_SECRET_ACCESS_KEY: 'legacy-secret',
    } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(false);
    expect(status.misconfigured).toBe(true);
    expect(status.missing).toEqual([
      'R2_ENDPOINT',
      'R2_BUCKET',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ]);
  });

  it('marks partial staging config as misconfigured with R2_* missing names', () => {
    const status = resolveStorageEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      STORAGE_PROVIDER: 'r2',
      R2_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
    } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(false);
    expect(status.misconfigured).toBe(true);
    expect(status.missing).toContain('R2_BUCKET');
    expect(status.missing).toContain('R2_ACCESS_KEY_ID');
    expect(status.missing).toContain('R2_SECRET_ACCESS_KEY');
    expect(status.missing).not.toContain('S3_BUCKET');
  });

  it('health summary never includes secrets', () => {
    const summary = storageHealthSummary(
      resolveStorageEnv({
        NODE_ENV: 'production',
        STORAGE_PROVIDER: 'r2',
        R2_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
        R2_BUCKET: 'e3lani',
        R2_ACCESS_KEY_ID: 'super-secret-key',
        R2_SECRET_ACCESS_KEY: 'super-secret-value',
      } as NodeJS.ProcessEnv),
    );
    const blob = JSON.stringify(summary);
    expect(blob).not.toContain('super-secret');
    expect(summary.endpointHost).toBe('abc123.r2.cloudflarestorage.com');
  });

  it('createStorageClient accepts R2 options', () => {
    const client = createStorageClient({
      endpoint: 'https://abc123.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'e3lani',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
      provider: 'r2',
      forcePathStyle: false,
    });
    expect(client).toBeTruthy();
  });

  it('enables sandbox without R2 credentials when STORAGE_PROVIDER=sandbox', () => {
    const status = resolveStorageEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      STORAGE_PROVIDER: 'sandbox',
      STORAGE_MODE: 'sandbox',
      SANDBOX_STORAGE_ENABLED: 'true',
    } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(true);
    expect(status.misconfigured).toBe(false);
    expect(status.provider).toBe('sandbox');
    expect(status.mode).toBe('sandbox');
    expect(status.missing).toEqual([]);
    expect(status.config).toBeUndefined();
  });
});

describe('sandbox signed urls', () => {
  it('creates and verifies upload signatures', async () => {
    const { createSandboxSignedUpload, verifySandboxUploadSig } = await import('./sandbox');
    const signed = createSandboxSignedUpload({
      apiPublicUrl: 'https://e3lani-api-staging.onrender.com',
      key: 'uploads/2026-07-27/user/image/abc.jpg',
      mimeType: 'image/jpeg',
      expiresInSeconds: 600,
    });
    expect(signed.method).toBe('PUT');
    expect(signed.uploadUrl).toContain('/api/v1/media/sandbox/upload?');
    const url = new URL(signed.uploadUrl);
    expect(
      verifySandboxUploadSig(
        url.searchParams.get('key')!,
        url.searchParams.get('mime')!,
        Number(url.searchParams.get('exp')),
        url.searchParams.get('sig')!,
      ),
    ).toBe(true);
  });
});
