import { createApiClient } from '@e3lani/api-client';

let token: string | null = null;

export function getToken() {
  return token;
}

export function setToken(value: string | null) {
  token = value;
}

const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

function resolveApiBaseUrl() {
  if (configured) return configured.replace(/\/$/, '');
  // Dev-only fallback. Release/staging builds MUST inject EXPO_PUBLIC_API_BASE_URL.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://127.0.0.1:3001/api/v1';
  }
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL is required for release builds (must not use localhost).',
  );
}

export const apiBaseUrl = resolveApiBaseUrl();

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getToken,
});
