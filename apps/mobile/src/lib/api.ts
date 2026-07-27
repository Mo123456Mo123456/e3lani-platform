import { createApiClient } from '@e3lani/api-client';

let token: string | null = null;

export function getToken() {
  return token;
}

export function setToken(value: string | null) {
  token = value;
}

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1';

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getToken,
});
