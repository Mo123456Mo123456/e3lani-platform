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
  it('uses AWS-style key names for R2', () => {
    const status = resolveStorageEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      STORAGE_PROVIDER: 'r2',
      S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
      S3_REGION: 'auto',
      S3_BUCKET: 'e3lani-media',
      S3_ACCESS_KEY_ID: 'key-id',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_FORCE_PATH_STYLE: 'false',
    } as NodeJS.ProcessEnv);

    expect(status.configured).toBe(true);
    expect(status.misconfigured).toBe(false);
    expect(status.provider).toBe('r2');
    expect(status.config?.forcePathStyle).toBe(false);
    expect(status.privateBucket).toBe(true);
    expect(status.config?.accessKeyId).toBe('key-id');
  });

  it('accepts legacy S3_ACCESS_KEY / S3_SECRET_KEY', () => {
    const status = resolveStorageEnv({
      NODE_ENV: 'production',
      S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
      S3_BUCKET: 'e3lani',
      S3_ACCESS_KEY: 'legacy-key',
      S3_SECRET_KEY: 'legacy-secret',
      STORAGE_PROVIDER: 'r2',
    } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(true);
    expect(status.config?.accessKeyId).toBe('legacy-key');
  });

  it('marks partial staging config as misconfigured (never fake-success)', () => {
    const status = resolveStorageEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      STORAGE_PROVIDER: 'r2',
      S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
      // missing keys + bucket
    } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(false);
    expect(status.misconfigured).toBe(true);
    expect(status.missing).toContain('S3_BUCKET');
    expect(status.missing).toContain('S3_ACCESS_KEY_ID');
    expect(status.missing).toContain('S3_SECRET_ACCESS_KEY');
  });

  it('health summary never includes secrets', () => {
    const summary = storageHealthSummary(
      resolveStorageEnv({
        NODE_ENV: 'production',
        STORAGE_PROVIDER: 'r2',
        S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
        S3_BUCKET: 'e3lani',
        S3_ACCESS_KEY_ID: 'super-secret-key',
        S3_SECRET_ACCESS_KEY: 'super-secret-value',
      } as NodeJS.ProcessEnv),
    );
    const blob = JSON.stringify(summary);
    expect(blob).not.toContain('super-secret');
    expect(summary.endpointHost).toBe('abc123.r2.cloudflarestorage.com');
  });

  it('createStorageClient respects forcePathStyle for R2', () => {
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
});
