"use client";

import type { SessionUser } from "@kawkab/shared-types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem("kawkab_at", token);
    else window.localStorage.removeItem("kawkab_at");
  }
}

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== "undefined") {
    accessToken = window.localStorage.getItem("kawkab_at");
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

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
}

async function tryRefresh(): Promise<boolean> {
  refreshPromise ??= (async () => {
    const res = await fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      setAccessToken(null);
      return false;
    }
    const data = (await res.json()) as { accessToken: string; user: SessionUser };
    setAccessToken(data.accessToken);
    return true;
  })().finally(() => {
    setTimeout(() => (refreshPromise = null), 0);
  });
  return refreshPromise;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await rawFetch(path, init);
  if (res.status === 401 && retry) {
    const ok = await tryRefresh();
    if (ok) return api<T>(path, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const authApi = {
  async login(email: string, password: string): Promise<{ user: SessionUser; accessToken: string }> {
    const data = await api<{ user: SessionUser; accessToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    return data;
  },
  async register(email: string, password: string, displayName: string, locale: string): Promise<{ user: SessionUser; accessToken: string }> {
    const data = await api<{ user: SessionUser; accessToken: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName, locale }),
    });
    setAccessToken(data.accessToken);
    return data;
  },
  async logout(): Promise<void> {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
  },
  async restore(): Promise<SessionUser | null> {
    const ok = await tryRefresh().catch(() => false);
    if (!ok) return null;
    const data = await api<{ user: SessionUser }>("/api/auth/me").catch(() => null);
    return data?.user ?? null;
  },
};
