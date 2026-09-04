import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * عميل VERO API لتطبيق العامل.
 *
 * التطبيق يتصل بخادم شركته هو فقط — لا يوجد أي خادم مركزي تابع للمطوّر.
 * عنوان الخادم يُحدَّد وقت البناء (extra.apiUrl) أو يُدخله الفني مرة واحدة عند التفعيل.
 */

const DEVICE_TOKEN_KEY = 'vero.deviceToken';
const API_URL_KEY = 'vero.apiUrl';
const IDENTITY_KEY = 'vero.identity';

export interface Identity {
  workerId: string;
  workerName: string;
  employeeNo: string;
  vehicleId: string;
  vehicleNo: string;
  companyName: string;
  timezone: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** خطأ شبكة يعني «أعد المحاولة لاحقًا»، لا «العملية فشلت نهائيًا». */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

const defaultApiUrl = (): string => {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return (extra?.apiUrl ?? '').replace(/\/$/, '');
};

let cachedApiUrl: string | null = null;
let cachedToken: string | null = null;

export async function getApiUrl(): Promise<string> {
  if (cachedApiUrl !== null) return cachedApiUrl;
  const stored = await SecureStore.getItemAsync(API_URL_KEY);
  cachedApiUrl = (stored ?? defaultApiUrl()).replace(/\/$/, '');
  return cachedApiUrl;
}

export async function setApiUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, '');
  cachedApiUrl = clean;
  await SecureStore.setItemAsync(API_URL_KEY, clean);
}

export async function getDeviceToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
  return cachedToken;
}

export async function setDeviceToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
}

export async function clearDevice(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
  await SecureStore.deleteItemAsync(IDENTITY_KEY);
}

export async function saveIdentity(id: Identity): Promise<void> {
  await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(id));
}

export async function loadIdentity(): Promise<Identity | null> {
  const raw = await SecureStore.getItemAsync(IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Identity;
  } catch {
    return null;
  }
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const base = await getApiUrl();
  if (!base) {
    throw new ApiError(0, 'NO_API_URL', 'عنوان خادم الشركة غير محدد في التطبيق');
  }

  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth !== false) {
    const token = await getDeviceToken();
    if (token) headers.authorization = `Device ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(
      0,
      'NETWORK',
      `تعذّر الاتصال بالخادم: ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = `فشل الطلب (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch {
      /* الرد ليس JSON */
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─────────────────────────── الأنواع ───────────────────────────

export interface ActivateResult {
  deviceToken: string;
  device: { id: string; deviceUid: string };
  worker: { id: string; fullName: string; employeeNo: string };
  vehicle: { id: string; internalNo: string; plateNo: string | null };
  company: { id: string; name: string; timezone: string };
}

export interface DeviceState {
  worker: { id: string; fullName: string };
  vehicle: { id: string; internalNo: string };
  company: { name: string; timezone: string };
  serviceDay: string;
  doneToday: number;
  remaining: number;
  totalBins: number;
  session: { id: string; startedAt: string; pointsCount: number } | null;
}

export interface ScanResult {
  outcome: 'accepted' | 'duplicate' | 'rejected';
  clientUuid: string;
  scanId: string | null;
  status: 'VERIFIED' | 'SUSPICIOUS' | 'INVALID';
  counted: boolean;
  distanceM: number | null;
  radiusM: number | null;
  serviceDay: string | null;
  reasons: string[];
  bin: { id: string; publicId: string; name: string | null } | null;
  message: string;
}

export interface SyncResult {
  results: ScanResult[];
  summary: { accepted: number; duplicates: number; rejected: number };
}
