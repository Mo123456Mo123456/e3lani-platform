'use client';

/**
 * عميل VERO API.
 *
 * مبدأ صارم: لا بيانات بديلة عند فشل الخادم. كل خطأ يُرفع كـ ApiError
 * لتعرضه الواجهة صراحةً للمستخدم — لا شاشات تبدو ناجحة والبيانات وهمية.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

const ACCESS_KEY = 'vero.accessToken';
const REFRESH_KEY = 'vero.refreshToken';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokens = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  raw?: boolean;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        tokens.set(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function toError(res: Response): Promise<ApiError> {
  let code = 'HTTP_ERROR';
  let message = `فشل الطلب (${res.status})`;
  let details: Record<string, unknown> | undefined;
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    }
  } catch {
    /* الرد ليس JSON */
  }
  return new ApiError(res.status, code, message, details);
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined && !(opts.body instanceof FormData)) {
      headers['content-type'] = 'application/json';
    }
    if (!opts.skipAuth && tokens.access) {
      headers.authorization = `Bearer ${tokens.access}`;
    }
    try {
      return await fetch(`${API_URL}${path}`, {
        method: opts.method ?? 'GET',
        headers,
        signal: opts.signal,
        body:
          opts.body === undefined
            ? undefined
            : opts.body instanceof FormData
              ? opts.body
              : JSON.stringify(opts.body),
      });
    } catch (err) {
      // الخادم غير متاح: نخبر المستخدم بوضوح بدل إظهار واجهة فارغة
      throw new ApiError(
        0,
        'NETWORK',
        'تعذّر الاتصال بخادم VERO. تأكد من تشغيل الخدمة ومن صحة عنوان الـAPI.',
        { apiUrl: API_URL, reason: (err as Error).message },
      );
    }
  };

  let res = await send();

  if (res.status === 401 && !opts.skipAuth && tokens.refresh) {
    if (await tryRefresh()) res = await send();
  }

  if (!res.ok) {
    const err = await toError(res);
    if (err.status === 401 && typeof window !== 'undefined') {
      tokens.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    throw err;
  }

  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** ينزّل ملفًا (PDF/Excel/نسخة احتياطية) مع الإبقاء على ترويسة المصادقة. */
export async function download(
  path: string,
  fallbackName: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<void> {
  const res = await api<Response>(path, { ...opts, raw: true });
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─────────────────────────── الأنواع المشتركة مع الخادم ───────────────────────────

export type Role = 'ADMIN' | 'SUPERVISOR' | 'VIEWER';

export interface Company {
  id: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  defaultGpsRadiusM: number;
  timezone: string;
  setupCompletedAt: string | null;
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DashboardStats {
  serviceDay: string;
  totalBins: number;
  activeBins: number;
  servicedToday: number;
  remaining: number;
  needsReview: number;
  completionRate: number;
  activeVehicles: number;
  offlineVehicles: number;
  activeSessions: number;
  offlineScansToday: number;
  suspiciousToday: number;
  invalidAttemptsToday: number;
}

export interface AttentionItem {
  kind: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  entity: string;
  entityId: string;
  at: string | null;
}

export interface Bin {
  id: string;
  publicId: string;
  name: string | null;
  sector: string | null;
  area: string | null;
  address: string | null;
  lat: number;
  lon: number;
  gpsRadiusM: number;
  status: string;
  qrPrintedAt: string | null;
  notes: string | null;
  createdAt: string;
  servicedOnDay?: boolean;
  lastScanAt?: string | null;
}

export interface MapBin {
  id: string;
  publicId: string;
  lat: number;
  lon: number;
  state: 'DONE' | 'PENDING' | 'REVIEW' | 'PROBLEM';
  sector: string | null;
}

export interface Vehicle {
  id: string;
  internalNo: string;
  name: string | null;
  plateNo: string | null;
  vehicleType: string | null;
  status: string;
  currentWorkerId: string | null;
  currentWorkerName?: string | null;
  lastSeenAt: string | null;
  lastLocation?: { lat: number; lon: number } | null;
  doneToday?: number;
}

export interface Worker {
  id: string;
  fullName: string;
  employeeNo: string;
  phone: string | null;
  status: string;
  defaultVehicleId: string | null;
  defaultVehicleNo?: string | null;
  doneToday?: number;
}

export interface Scan {
  id: string;
  binId: string;
  binPublicId: string;
  binName: string | null;
  workerName: string | null;
  vehicleNo: string | null;
  scannedAt: string;
  receivedAt: string;
  serviceDay: string;
  lat: number;
  lon: number;
  accuracyM: number | null;
  distanceM: number;
  radiusM: number;
  status: 'VERIFIED' | 'SUSPICIOUS' | 'INVALID';
  counted: boolean;
  offline: boolean;
  reasons: string[];
  reviewStatus: string;
  reviewNote: string | null;
  proofHash: string;
  prevHash: string | null;
  chainSeq: number;
}

export interface LiveVehicle {
  vehicleId: string;
  internalNo: string;
  plateNo: string | null;
  workerName: string | null;
  lat: number | null;
  lon: number | null;
  lastSeenAt: string | null;
  online: boolean;
  doneToday: number;
  sessionId: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportSummary {
  id: string;
  reportNo: string;
  kind: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  createdByName: string | null;
  complianceRate: number;
}

export interface AuditEntry {
  id: string;
  actorName: string | null;
  actorLabel: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

export interface BackupItem {
  id: string;
  filename: string;
  sizeBytes: number;
  kind: string;
  status: string;
  error: string | null;
  createdAt: string;
  createdByName: string | null;
  available: boolean;
}
