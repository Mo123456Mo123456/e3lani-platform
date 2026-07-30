export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const ADMIN_ROLES = new Set(["system_admin", "super_admin"]);

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  level?: number;
  xp?: number;
  locale?: string;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken?: string;
  token?: string;
  user: AdminUser;
}

export interface AdminOverview {
  users: number;
  planets: number;
  pendingContributions: number;
  appliedContributions: number;
  events: number;
  moderationRejected: number;
}

export interface PlanetSummary {
  id: string;
  name?: string;
  nameAr?: string;
  tick?: number;
  year?: number;
  pollution?: number;
  temperature?: number;
  biodiversity?: number;
  regions?: unknown[];
  civilizations?: unknown[];
}

export interface ApiSession {
  token: string;
  user: AdminUser;
}

export interface AuditLog {
  id?: string;
  action?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: unknown;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ModerationResult {
  id?: string;
  allowed?: boolean;
  reason?: string;
  category?: string;
  text?: string;
  createdAt?: string;
  contributionId?: string;
  userId?: string;
  [key: string]: unknown;
}

function apiUrl(path: string) {
  const base = API_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const maybeMessage = body && typeof body === "object" && "message" in body ? (body as { message?: unknown }).message : undefined;
    const message = Array.isArray(maybeMessage)
      ? maybeMessage.join(", ")
      : typeof maybeMessage === "string"
        ? maybeMessage
        : `API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export async function apiFetch<T>(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return parseResponse<T>(
    await fetch(apiUrl(path), {
      ...init,
      headers,
      cache: "no-store",
    }),
  );
}

export async function login(email: string, password: string): Promise<ApiSession> {
  const auth = await apiFetch<AuthResponse>("/auth/login", undefined, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const token = auth.accessToken ?? auth.token;

  if (!token) {
    throw new Error("Login succeeded but no access token was returned");
  }

  if (!ADMIN_ROLES.has(auth.user.role)) {
    throw new Error("This account is not allowed to access the admin console");
  }

  return { token, user: auth.user };
}

export function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
