'use client';

import type { Permission } from '@e3lani/config';

export const API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'e3lani.admin.token';

export interface AdminIdentity {
  id: string;
  email: string;
  role: string;
  permissions: Permission[];
}

export const adminSession = {
  token: (): string | null =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY),
  save: (token: string): void => window.localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => window.localStorage.removeItem(TOKEN_KEY),
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = adminSession.token();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      adminSession.clear();
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    throw new AdminApiError(payload.message ?? 'تعذّر إتمام الطلب', response.status, payload.code);
  }
  return payload as T;
}

export const adminLogin = (email: string, password: string) =>
  adminFetch<{ accessToken: string; admin: { id: string; name: string; email: string; role: string } }>(
    '/auth/admin/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );

export const getIdentity = () => adminFetch<AdminIdentity>('/admin/me');
