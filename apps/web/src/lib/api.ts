import type {
  AdDto, CategoryDto, CityDto, PaginatedDto, PostDto, PricingItemDto, PublicAccountDto,
  TickerLogoDto,
} from '@e3lani/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

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

export interface RequestOptions extends RequestInit {
  token?: string | null;
  /** ثوانٍ التخزين المؤقت لطلبات الخادم */
  revalidate?: number;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, revalidate, headers, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    ...(typeof revalidate === 'number'
      ? { next: { revalidate } }
      : rest.cache
        ? {}
        : { cache: 'no-store' as RequestCache }),
  });

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

/* ------------------------- طلبات القراءة العامة ------------------------- */

export const getFeed = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams(
    Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value !== undefined && value !== '') acc[key] = String(value);
      return acc;
    }, {}),
  );
  return apiFetch<PaginatedDto<AdDto> & { cityId?: string }>(`/feed?${query.toString()}`);
};

export const getAd = (id: string) => apiFetch<AdDto>(`/ads/${id}`);

export const getTicker = () =>
  apiFetch<{ enabled: boolean; logos: TickerLogoDto[] }>('/ticker', { revalidate: 60 });

export const getCategories = () => apiFetch<CategoryDto[]>('/categories?withCounts=true', { revalidate: 300 });

export const getCities = () => apiFetch<CityDto[]>('/cities', { revalidate: 600 });

export const getAccount = (id: string) =>
  apiFetch<PublicAccountDto & { shareUrl: string; stats: { activeAds: number; posts: number; totalViews: number } }>(
    `/accounts/${id}`,
  );

export const getAccountAds = (id: string, cursor?: string) =>
  apiFetch<PaginatedDto<AdDto>>(`/accounts/${id}/ads${cursor ? `?cursor=${cursor}` : ''}`);

export const getAccountPosts = (id: string, cursor?: string) =>
  apiFetch<PaginatedDto<PostDto>>(`/accounts/${id}/posts${cursor ? `?cursor=${cursor}` : ''}`);

export const search = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams(
    Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value !== undefined && value !== '' && value !== false) acc[key] = String(value);
      return acc;
    }, {}),
  );
  return apiFetch<PaginatedDto<AdDto>>(`/search?${query.toString()}`);
};

export const getPricing = () =>
  apiFetch<{ items: PricingItemDto[]; publishingMode: 'FREE' | 'PAID'; paymentsEnabled: boolean }>(
    '/pricing',
    { revalidate: 120 },
  );
