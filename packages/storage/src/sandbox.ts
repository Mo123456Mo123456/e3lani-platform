import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

export type SandboxSignedUpload = {
  assetKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresInSeconds: number;
};

const SANDBOX_HMAC_SECRET =
  process.env.SANDBOX_STORAGE_HMAC_SECRET?.trim() || 'e3lani-sandbox-storage-hmac';

export function isSandboxStorageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const provider = (env.STORAGE_PROVIDER ?? '').trim().toLowerCase();
  const mode = (env.STORAGE_MODE ?? '').trim().toLowerCase();
  return (
    provider === 'sandbox' ||
    mode === 'sandbox' ||
    env.SANDBOX_STORAGE_ENABLED === 'true' ||
    env.SANDBOX_STORAGE_ENABLED === '1'
  );
}

export function sandboxRoot(): string {
  return (
    process.env.SANDBOX_STORAGE_DIR?.trim() ||
    join(tmpdir(), 'e3lani-sandbox-storage')
  );
}

function objectPath(key: string): string {
  return join(sandboxRoot(), key);
}

export async function sandboxEnsureRoot(): Promise<void> {
  await fs.mkdir(sandboxRoot(), { recursive: true });
}

export async function sandboxPutObject(
  key: string,
  body: Buffer,
  contentType?: string,
): Promise<void> {
  const dest = objectPath(key);
  await fs.mkdir(dirname(dest), { recursive: true });
  await fs.writeFile(dest, body);
  if (contentType) {
    await fs.writeFile(`${dest}.meta.json`, JSON.stringify({ contentType, size: body.length }));
  }
}

export async function sandboxHeadObject(
  key: string,
): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string }> {
  try {
    const dest = objectPath(key);
    const stat = await fs.stat(dest);
    let contentType: string | undefined;
    try {
      const meta = JSON.parse(await fs.readFile(`${dest}.meta.json`, 'utf8')) as {
        contentType?: string;
      };
      contentType = meta.contentType;
    } catch {
      /* optional */
    }
    return {
      exists: true,
      sizeBytes: stat.size,
      ...(contentType ? { contentType } : {}),
    };
  } catch {
    return { exists: false };
  }
}

export async function sandboxGetObject(key: string): Promise<Buffer> {
  return fs.readFile(objectPath(key));
}

export async function sandboxDeleteObject(key: string): Promise<void> {
  const dest = objectPath(key);
  await fs.rm(dest, { force: true });
  await fs.rm(`${dest}.meta.json`, { force: true });
}

function signPayload(payload: string): string {
  return createHmac('sha256', SANDBOX_HMAC_SECRET).update(payload).digest('hex');
}

export function createSandboxUploadSig(key: string, mimeType: string, exp: number): string {
  return signPayload(`PUT\n${key}\n${mimeType}\n${exp}`);
}

export function createSandboxDownloadSig(key: string, exp: number): string {
  return signPayload(`GET\n${key}\n${exp}`);
}

export function verifySandboxUploadSig(
  key: string,
  mimeType: string,
  exp: number,
  sig: string,
): boolean {
  if (Date.now() / 1000 > exp) return false;
  const expected = createSandboxUploadSig(key, mimeType, exp);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export function verifySandboxDownloadSig(key: string, exp: number, sig: string): boolean {
  if (Date.now() / 1000 > exp) return false;
  const expected = createSandboxDownloadSig(key, exp);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export function apiPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.API_PUBLIC_URL?.trim() ||
    env.PUBLIC_API_URL?.trim() ||
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
}

export function createSandboxSignedUpload(input: {
  apiPublicUrl?: string;
  key: string;
  mimeType: string;
  expiresInSeconds?: number;
}): SandboxSignedUpload {
  const expiresInSeconds = input.expiresInSeconds ?? 900;
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const sig = createSandboxUploadSig(input.key, input.mimeType, exp);
  const base = (input.apiPublicUrl ?? apiPublicBaseUrl()).replace(/\/$/, '');
  const uploadUrl = `${base}/api/v1/media/sandbox/upload?key=${encodeURIComponent(input.key)}&exp=${exp}&sig=${sig}&mime=${encodeURIComponent(input.mimeType)}`;
  return {
    assetKey: input.key,
    uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': input.mimeType },
    expiresInSeconds,
  };
}

export function createSandboxSignedDownload(input: {
  apiPublicUrl?: string;
  key: string;
  expiresInSeconds?: number;
}): string {
  const expiresInSeconds = input.expiresInSeconds ?? 3600;
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const sig = createSandboxDownloadSig(input.key, exp);
  const base = (input.apiPublicUrl ?? apiPublicBaseUrl()).replace(/\/$/, '');
  return `${base}/api/v1/media/sandbox/download?key=${encodeURIComponent(input.key)}&exp=${exp}&sig=${sig}`;
}

export async function checkSandboxStorageHealth(): Promise<{
  healthy: boolean;
  message: string;
  root: string;
}> {
  try {
    await sandboxEnsureRoot();
    const probe = join(sandboxRoot(), '.health');
    await fs.writeFile(probe, String(Date.now()));
    await fs.rm(probe, { force: true });
    return { healthy: true, message: 'sandbox storage ok', root: sandboxRoot() };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'sandbox storage unhealthy',
      root: sandboxRoot(),
    };
  }
}
