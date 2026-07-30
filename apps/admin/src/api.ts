/** Admin API client — cookieless bearer auth via /api proxy. */
import type { Role } from "@planet/shared-types";

const BASE = "/api";

let token: string | null = null;
export function setToken(next: string | null): void {
  token = next;
  if (next) sessionStorage.setItem("pg-admin-token", next);
  else sessionStorage.removeItem("pg-admin-token");
}
export function getToken(): string | null {
  token ??= sessionStorage.getItem("pg-admin-token");
  return token;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const t = getToken();
  if (t) headers.set("authorization", `Bearer ${t}`);
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  createdAt: string;
}

export interface SimulationStatus {
  planets: Array<{
    id: string;
    name: string;
    tick: number;
    year: number;
    status: string;
    autoTicking: boolean;
    stats: { civilizationCount: number; cityCount: number; speciesCount: number; eventCount: number; activeWarCount: number };
  }>;
}

export const adminApi = {
  login: (email: string, password: string) =>
    req<{ user: { roles: Role[] }; tokens: { accessToken: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  users: () => req<{ users: AdminUser[] }>("/admin/users?limit=200"),
  assignRoles: (userId: string, roles: Role[]) =>
    req(`/admin/users/${userId}/roles`, { method: "POST", body: JSON.stringify({ roles }) }),
  moderation: () =>
    req<{ queue: Array<{ id: string; targetId: string; verdict: string; reasons: string[]; createdAt: string }> }>("/admin/moderation?limit=100"),
  aiUsage: () =>
    req<{ logs: Array<{ id: string; provider: string; kind: string; costUsd: number; latencyMs: number; success: boolean; createdAt: string }>; totalCostUsd: number; failures: number; sandbox: boolean }>("/admin/ai-usage?limit=100"),
  audit: () =>
    req<{ entries: Array<{ id: string; actorId: string; action: string; detail: Record<string, unknown>; createdAt: string }> }>("/admin/audit?limit=100"),
  simulation: () => req<SimulationStatus>("/admin/simulation"),
  advance: (planetId: string, ticks: number) =>
    req<{ tick: number; year: number; eventsEmitted: number }>(`/planets/${planetId}/ticks`, { method: "POST", body: JSON.stringify({ ticks }) }),
  pause: (planetId: string) => req(`/planets/${planetId}/pause`, { method: "POST", body: "{}" }),
  resume: (planetId: string) => req(`/planets/${planetId}/resume`, { method: "POST", body: "{}" }),
  rollback: (planetId: string, tick: number) =>
    req<{ tick: number; year: number }>(`/planets/${planetId}/rollback`, { method: "POST", body: JSON.stringify({ tick }) }),
  snapshots: async (planetId: string) => {
    const timeline = await req<{ snapshots: number[] }>(`/planets/${planetId}/timeline`);
    return timeline.snapshots;
  },
};
