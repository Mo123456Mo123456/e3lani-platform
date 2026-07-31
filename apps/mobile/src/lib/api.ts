import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { AuthTokensDto } from '@e3lani/types';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; siteUrl?: string };

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:4000/api';
export const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL ?? extra.siteUrl ?? 'https://e3lani.sa';

const ACCESS_KEY = 'e3lani.access';
const REFRESH_KEY = 'e3lani.refresh';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly errors?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

export const tokens = {
  async access(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },
  async refresh(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async save(value: AuthTokensDto): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, value.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, value.refreshToken);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

interface Options extends RequestInit {
  auth?: boolean;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { auth = false, headers, ...rest } = options;
  const accessToken = auth ? await tokens.access() : null;

  const send = async (token: string | null): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });

  let response = await send(accessToken);

  if (response.status === 401 && auth) {
    const refreshToken = await tokens.refresh();
    if (refreshToken) {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshResponse.ok) {
        const fresh = (await refreshResponse.json()) as AuthTokensDto;
        await tokens.save(fresh);
        response = await send(fresh.accessToken);
      } else {
        await tokens.clear();
      }
    }
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      payload.message ?? 'تعذّر إتمام الطلب',
      response.status,
      payload.code,
      payload.errors,
    );
  }
  return payload as T;
}

export const buildQuery = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
};
