"use client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem("kawkab_admin_at", token);
    else window.localStorage.removeItem("kawkab_admin_at");
  }
}

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== "undefined") {
    accessToken = window.localStorage.getItem("kawkab_admin_at");
  }
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API ${status}`);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (res.status === 401) {
    const refresh = await fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include" });
    if (refresh.ok) {
      const data = (await refresh.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      return api<T>(path, init);
    }
    setAccessToken(null);
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function adminLogin(email: string, password: string): Promise<{ user: { id: string; role: string; displayName: string } }> {
  const data = await api<{ user: { id: string; role: string; displayName: string }; accessToken: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const adminRoles = ["MODERATOR", "SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN"];
  if (!adminRoles.includes(data.user.role)) {
    throw new ApiError(403, { message: "هذا الحساب لا يملك صلاحيات الإدارة." });
  }
  setAccessToken(data.accessToken);
  return data;
}
