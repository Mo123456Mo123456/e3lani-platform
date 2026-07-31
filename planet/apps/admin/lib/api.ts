"use client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

let token: string | null = null;
export function setToken(t: string | null): void {
  token = t;
  if (typeof sessionStorage !== "undefined") {
    if (t) sessionStorage.setItem("planet-admin-token", t);
    else sessionStorage.removeItem("planet-admin-token");
  }
}
export function getToken(): string | null {
  if (!token && typeof sessionStorage !== "undefined") {
    token = sessionStorage.getItem("planet-admin-token");
  }
  return token;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const t = getToken();
  if (t) headers["authorization"] = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    credentials: "include",
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data["error"] as string) ?? `http_${res.status}`);
  return data as T;
}
