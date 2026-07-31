'use client';

import type { AuthTokensDto, SessionUserDto } from '@e3lani/types';
import { apiFetch } from './api';

const ACCESS_KEY = 'e3lani.access';
const REFRESH_KEY = 'e3lani.refresh';

export const session = {
  accessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  refreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  save(tokens: AuthTokensDto): void {
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear(): void {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

/** طلب مصادَق عليه مع تجديد تلقائي للرمز عند انتهائه. */
export async function authedFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = session.accessToken();
  try {
    return await apiFetch<T>(path, { ...options, token });
  } catch (error: any) {
    if (error?.status !== 401) throw error;
    const refreshToken = session.refreshToken();
    if (!refreshToken) throw error;

    const tokens = await apiFetch<AuthTokensDto>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);

    if (!tokens) {
      session.clear();
      throw error;
    }
    session.save(tokens);
    return apiFetch<T>(path, { ...options, token: tokens.accessToken });
  }
}

export const getMe = () => authedFetch<SessionUserDto>('/auth/me');
