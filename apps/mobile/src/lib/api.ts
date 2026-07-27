import { createApiClient } from '@e3lani/api-client';

let token: string | null = null;

export function getToken() {
  return token;
}

export function setToken(value: string | null) {
  token = value;
}

/**
 * Preferred build-time var: EXPO_PUBLIC_API_URL (host or full /api/v1 URL).
 * Back-compat: EXPO_PUBLIC_API_BASE_URL.
 */
function normalizeApiBaseUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  if (/\/api\/v1$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api/v1`;
}

const configured = (
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  ''
).trim();

function resolveApiBaseUrl() {
  if (configured) {
    const url = normalizeApiBaseUrl(configured);
    if (/localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(url)) {
      throw new Error(
        'Release builds must not use localhost / 127.0.0.1 / 10.0.2.2 for API URL.',
      );
    }
    return url;
  }
  // Dev-only fallback. Release/staging builds MUST inject EXPO_PUBLIC_API_URL.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://127.0.0.1:3001/api/v1';
  }
  throw new Error(
    'EXPO_PUBLIC_API_URL is required for release builds (must not use localhost).',
  );
}

export const apiBaseUrl = resolveApiBaseUrl();
export const apiOrigin = apiBaseUrl.replace(/\/api\/v1$/i, '');

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getToken,
  timeoutMs: 20_000,
});

export type ServerHealth = {
  ok: boolean;
  status?: string;
  detail?: string;
  checkedAt: string;
};

export async function checkServerHealth(): Promise<ServerHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await api.health();
    return {
      ok: res?.status === 'ok' || Boolean(res?.status),
      status: res?.status,
      checkedAt,
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      checkedAt,
    };
  }
}
