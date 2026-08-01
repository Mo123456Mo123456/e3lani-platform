import { Platform } from 'react-native';
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

/**
 * تخزين الرموز.
 *
 * على الأجهزة نستخدم المخزن الآمن (Keychain / Keystore)، وعلى الويب نستخدم
 * تخزين المتصفح لأن expo-secure-store غير مدعوم هناك.
 *
 * كل العمليات لا ترمي استثناءات إطلاقًا: فشل التخزين يعني «لا توجد جلسة»
 * ويستمر التطبيق كزائر — بدل أن تتعطّل الواجهة عند الإقلاع.
 */
const isWeb = Platform.OS === 'web';

async function readToken(key: string): Promise<string | null> {
  try {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeToken(key: string, value: string): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // تعذّر الحفظ: الجلسة تبقى في الذاكرة لهذه الجولة فقط
  }
}

async function removeToken(key: string): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // تجاهل
  }
}

export const tokens = {
  access: () => readToken(ACCESS_KEY),
  refresh: () => readToken(REFRESH_KEY),
  async save(value: AuthTokensDto): Promise<void> {
    await writeToken(ACCESS_KEY, value.accessToken);
    await writeToken(REFRESH_KEY, value.refreshToken);
  },
  async clear(): Promise<void> {
    await removeToken(ACCESS_KEY);
    await removeToken(REFRESH_KEY);
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
