'use client';

import { createApiClient } from '@e3lani/api-client';

const TOKEN_KEY = 'e3lani_admin_token';
const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:3001/api/v1';

export const apiBaseUrl = normalizeApiBaseUrl(rawApiUrl);

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const baseApi = createApiClient({
  baseUrl: apiBaseUrl,
  getToken,
});

async function request<T>(
  method: string,
  path: string,
  init?: { body?: unknown; headers?: Record<string, string>; auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers ?? {}) };
  if (init?.body !== undefined) headers['content-type'] = 'application/json';
  if (init?.auth !== false) {
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

function normalizeApiBaseUrl(url: string) {
  const clean = url.replace(/\/$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
}

export const api = {
  ...baseApi,
  adminUsers: () => request<any[]>('GET', '/admin/users'),
  adminVerification: () => request<any[]>('GET', '/admin/verification'),
  adminDecideVerification: (id: string, body: { status: string; notes?: string }) =>
    request('PATCH', `/admin/verification/${id}`, { body }),
  adminReports: () => request<any[]>('GET', '/admin/reports'),
  adminResolveReport: (id: string, body: { status?: string; resolution?: string }) =>
    request('PATCH', `/admin/reports/${id}`, { body }),
  adminAppeals: () => request<any[]>('GET', '/admin/appeals'),
  adminDecideAppeal: (id: string, body: { status: string; decisionNote?: string }) =>
    request('PATCH', `/admin/appeals/${id}`, { body }),
  adminCategories: () => request<any[]>('GET', '/admin/categories'),
  adminToggleCategory: (id: string) => request('POST', `/admin/categories/${id}/toggle-active`),
  adminCreateCategory: (body: {
    slug: string;
    nameAr: string;
    nameEn: string;
    iconKey?: string;
    sortOrder?: number;
    countryCode?: string;
  }) => request('POST', '/admin/categories', { body }),
  adminPricing: () => request<any[]>('GET', '/admin/pricing'),
  adminRefundOrders: () => request<any[]>('GET', '/admin/refunds'),
  refundOrder: (id: string, body: { amount?: number; reason?: string }) =>
    request('POST', `/orders/${id}/refunds`, {
      body,
      headers: { 'idempotency-key': `${id}:admin:${Date.now()}` },
    }),
  adminCampaigns: () => request<any[]>('GET', '/admin/campaigns'),
  adminUpdateCampaignStatus: (id: string, status: string) =>
    request('PATCH', `/admin/campaigns/${id}/status`, { body: { status } }),
  adminCampaignReport: (id: string) => request<any>('GET', `/admin/campaigns/${id}/report`),
  adminTemplates: () => request<any>('GET', '/admin/templates'),
  adminUpdateTemplates: (body: unknown) => request<any>('PATCH', '/admin/templates', { body }),
  adminFlags: () => request<any>('GET', '/admin/flags'),
  adminUpdateFlags: (body: unknown) => request<any>('PATCH', '/admin/flags', { body }),
  healthReady: () => request<any>('GET', '/health/ready', { auth: false }),
  adminAudit: () => request<any[]>('GET', '/admin/audit'),
};
