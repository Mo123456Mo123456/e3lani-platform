"use client";

/** API client with access-token memory store and silent refresh. */

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem("planet-has-session", "1");
    else localStorage.removeItem("planet-has-session");
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken?: string };
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean; retry?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth && accessToken) headers["authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    credentials: "include",
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.status === 401 && opts.auth && opts.retry !== false) {
    const ok = await tryRefresh();
    if (ok) return api<T>(path, { ...opts, retry: false });
    setAccessToken(null);
    throw new ApiError(401, "unauthorized");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, (data["error"] as string) ?? `http_${res.status}`);
  if ((data as { error?: string }).error && res.ok) throw new ApiError(res.status, (data as { error?: string }).error!);
  return data as T;
}

export async function apiHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export { API_URL };
