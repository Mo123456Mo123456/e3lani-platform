const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

export { API_URL, WS_URL };

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  locale: string;
  level: number;
  xp: number;
};

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("pb_access");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...(init?.headers ?? {}),
  };
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "request_failed"), {
      status: res.status,
      data: err,
    });
  }
  return res.json() as Promise<T>;
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem("pb_access", access);
  localStorage.setItem("pb_refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("pb_access");
  localStorage.removeItem("pb_refresh");
}
