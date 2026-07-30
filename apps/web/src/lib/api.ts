const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  level: number;
  xp: number;
  locale: string;
};

function authHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...init } = opts;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init.headers ?? {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error("api_error"), { status: res.status, data: err });
  }
  return res.json() as Promise<T>;
}

export const api = {
  url: API_URL,
  register: (body: {
    email: string;
    password: string;
    displayName: string;
    locale?: "ar" | "en";
  }) =>
    request<{ accessToken: string; user: ApiUser }>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; user: ApiUser }>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: (token: string) =>
    request<{ user: ApiUser }>("/v1/auth/me", { token }),
  planets: () => request<{ planets: Array<Record<string, unknown>> }>("/v1/planets"),
  planet: (id: string) =>
    request<{
      planet: Record<string, unknown>;
      overlays: Record<string, unknown> | null;
    }>(`/v1/planets/${id}`),
  regions: (id: string, limit = 180) =>
    request<{ regions: Array<Record<string, unknown>> }>(
      `/v1/planets/${id}/regions?limit=${limit}`,
    ),
  region: (planetId: string, regionId: string) =>
    request<Record<string, unknown>>(`/v1/planets/${planetId}/regions/${regionId}`),
  events: (id: string, limit = 30) =>
    request<{ events: Array<Record<string, unknown>> }>(
      `/v1/planets/${id}/events?limit=${limit}`,
    ),
  timeline: (id: string) =>
    request<{ items: Array<Record<string, unknown>> }>(`/v1/planets/${id}/timeline`),
  impact: (token: string) =>
    request<{
      elementsAdded: number;
      totalChanges: number;
      civilizationsAffected: number;
      evolutionDays: number;
      lastEventTitle?: string;
    }>("/v1/me/impact", { token }),
  analyze: (
    token: string,
    body: { category: string; idea: string; locale: "ar" | "en" },
  ) =>
    request<Record<string, unknown>>("/v1/contributions/analyze", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  apply: (token: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/v1/contributions/apply", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  notifications: (token: string) =>
    request<{ notifications: Array<Record<string, unknown>> }>("/v1/me/notifications", {
      token,
    }),
  causal: (id: string) =>
    request<{ graph: Record<string, unknown> }>(`/v1/contributions/${id}/causal`),
};
