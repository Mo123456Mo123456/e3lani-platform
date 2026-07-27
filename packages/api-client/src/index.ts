export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(options: ApiClientOptions) {
  async function request<T>(
    method: string,
    path: string,
    init?: { body?: unknown; headers?: Record<string, string>; auth?: boolean },
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(init?.headers ?? {}),
    };
    if (init?.body !== undefined) headers['content-type'] = 'application/json';
    if (init?.auth !== false) {
      const token = options.getToken ? await options.getToken() : null;
      if (token) headers.authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${options.baseUrl.replace(/\/$/, '')}${path}`, {
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
      throw new ApiError(
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message: unknown }).message)
          : `HTTP ${res.status}`,
        res.status,
        data,
      );
    }
    return data as T;
  }

  return {
    health: () => request<{ status: string }>('GET', '/health', { auth: false }),
    requestOtp: (body: {
      phone: string;
      acceptedTerms: true;
      locale?: 'ar' | 'en';
      countryCode?: string;
    }) =>
      request<{ requestId: string; sandboxCode?: string; expiresAt: string }>(
        'POST',
        '/auth/request-otp',
        { body, auth: false },
      ),
    verifyOtp: (body: { phone: string; code: string; deviceId?: string }) =>
      request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; phone: string; displayName?: string | null; roles: string[] };
      }>('POST', '/auth/verify-otp', { body, auth: false }),
    me: () => request<Record<string, unknown>>('GET', '/users/me'),
    categories: () => request<Category[]>('GET', '/categories', { auth: false }),
    cities: (countryCode = 'SA') =>
      request<City[]>('GET', countryCode === 'SA' ? '/cities' : `/countries/${countryCode}/cities`, {
        auth: false,
      }),
    feed: (tab: 'forYou' | 'latest' | 'nearby' = 'forYou', cursor?: string) => {
      const path =
        tab === 'latest' ? '/feed/latest' : tab === 'nearby' ? '/feed/nearby' : '/feed';
      const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      return request<FeedPage>('GET', `${path}${q}`, { auth: false });
    },
    getAd: (id: string) => request<AdDetail>('GET', `/ads/${id}`, { auth: false }),
    myAds: () => request<AdDetail[]>('GET', '/ads/mine'),
    createAd: (body: CreateAdBody) => request<AdDetail>('POST', '/ads', { body }),
    reviseAd: (id: string, body: CreateAdBody) =>
      request<AdDetail>('POST', `/ads/${id}/revisions`, { body }),
    submitReview: (id: string) => request<AdDetail>('POST', `/ads/${id}/submit-review`),
    uploadIntent: (body: {
      kind: 'image' | 'video';
      mimeType: string;
      sizeBytes: number;
      durationSeconds?: number;
    }) =>
      request<{
        assetId: string;
        uploadUrl: string;
        method: 'PUT';
        headers: Record<string, string>;
        assetKey: string;
      }>('POST', '/media/upload-intent', { body }),
    completeUpload: (assetId: string) =>
      request<MediaAsset>('POST', `/media/${assetId}/complete`),
    getMedia: (assetId: string) => request<MediaAsset>('GET', `/media/${assetId}`),
    attachMedia: (adId: string, assetId: string, sortOrder = 0) =>
      request('POST', `/ads/${adId}/media`, { body: { assetId, sortOrder } }),
    paymentOptions: (adId: string) =>
      request<PaymentOptions>('GET', `/ads/${adId}/payment-options?platform=web`, { auth: false }),
    createOrder: (adId: string, idempotencyKey: string, urls?: { successUrl?: string; cancelUrl?: string }) =>
      request<{
        order: { id: string; total: string | number; status: string };
        checkout: { checkoutUrl?: string; providerReference: string };
        activationPolicy: string;
      }>('POST', '/orders', {
        body: {
          adId,
          successUrl: urls?.successUrl ?? 'http://localhost:3000/payment/success',
          cancelUrl: urls?.cancelUrl ?? 'http://localhost:3000/payment/cancel',
        },
        headers: { 'idempotency-key': idempotencyKey },
      }),
    saved: () => request<Array<{ ad: AdDetail }>>('GET', '/saved'),
    saveAd: (id: string) => request('POST', `/ads/${id}/save`),
    unsaveAd: (id: string) => request('DELETE', `/ads/${id}/save`),
    brand: (slug: string) => request<BrandProfile>('GET', `/brands/${slug}`, { auth: false }),
    adminReviewQueue: () => request<AdDetail[]>('GET', '/admin/ads/review'),
    adminApprove: (id: string, notes?: string) =>
      request('POST', `/admin/ads/${id}/approve`, { body: { notes } }),
    adminNeedsChanges: (id: string, notes: string) =>
      request('POST', `/admin/ads/${id}/needs-changes`, { body: { notes } }),
    adminReject: (id: string, notes: string) =>
      request('POST', `/admin/ads/${id}/reject`, { body: { notes } }),
    adminOrders: () => request<unknown[]>('GET', '/admin/orders'),
    adminPayments: () => request<unknown[]>('GET', '/admin/payments'),
  };
}

export type E3laniApi = ReturnType<typeof createApiClient>;

export type Category = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  iconKey?: string | null;
  children?: Category[];
};

export type City = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  countryCode: string;
};

export type MediaAsset = {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  status: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number | null;
  storageKey: string;
  posterKey?: string | null;
  urls?: { source: string; poster: string | null; playback: string };
};

export type AdDetail = {
  id: string;
  status: string;
  publishedAt?: string | null;
  expiresAt?: string | null;
  currentRevision?: {
    id: string;
    version: number;
    title: string;
    description?: string | null;
    category?: Category;
    city?: City;
    contactMethods?: {
      storeUrl?: string;
      whatsapp?: string;
      phone?: string;
    };
  } | null;
  owner?: {
    id: string;
    displayName?: string | null;
    brandProfile?: {
      slug?: string;
      nameAr?: string;
      logoUrl?: string | null;
      isVerified?: boolean;
    } | null;
  };
  media?: Array<{ id: string; sortOrder: number; kind: string; asset: MediaAsset }>;
};

export type FeedPage = {
  items: AdDetail[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type CreateAdBody = {
  title: string;
  description?: string;
  categoryId: string;
  countryCode: string;
  cityId: string;
  contactMethods: {
    storeUrl?: string;
    whatsapp?: string;
    phone?: string;
  };
};

export type PaymentOptions = {
  adId: string;
  revisionId: string;
  quote: { total: number; currency: string; lines: unknown[] };
  routing: { ok: boolean; provider?: { name: string }; channel?: string; reason?: string };
  messageAr?: string;
};

export type BrandProfile = {
  slug: string;
  nameAr: string;
  nameEn?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
  isVerified: boolean;
  ads: AdDetail[];
};

export async function uploadFileToSignedUrl(
  uploadUrl: string,
  file: Blob,
  headers: Record<string, string>,
) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

export async function pollMediaReady(
  api: E3laniApi,
  assetId: string,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<MediaAsset> {
  const timeoutMs = opts?.timeoutMs ?? 60000;
  const intervalMs = opts?.intervalMs ?? 1000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const asset = await api.getMedia(assetId);
    if (asset.status === 'READY' || asset.status === 'FAILED') return asset;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Media processing timeout');
}
