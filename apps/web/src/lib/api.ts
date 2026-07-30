/**
 * Typed API client with automatic refresh-token rotation.
 */
import type {
  AuthTokens,
  Contribution,
  Notification,
  PlanetSummary,
  ScenarioReport,
  StructuredContribution,
  BalanceReport,
  User,
  WorldEvent,
} from "@planet/shared-types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export interface Session {
  user: User;
  tokens: AuthTokens;
}

const STORAGE_KEY = "planet-session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const session = loadSession();
  if (!session) return false;
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    });
    if (!response.ok) {
      saveSession(null);
      return false;
    }
    const body = (await response.json()) as { user: User; tokens: AuthTokens };
    saveSession({ user: body.user, tokens: body.tokens });
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = loadSession();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (session) headers.set("authorization", `Bearer ${session.tokens.accessToken}`);

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && session) {
    refreshing ??= tryRefresh().finally(() => {
      refreshing = null;
    });
    if (await refreshing) return request<T>(path, init, false);
    throw new ApiError(401, "unauthorized", "session expired");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new ApiError(response.status, body.error ?? "request_failed", body.detail ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// --- auth -------------------------------------------------------------------
export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<Session>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    request<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => {
    const session = loadSession();
    saveSession(null);
    if (session) {
      void request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
      });
    }
  },
  me: () =>
    request<{ user: User; stats: { contributions: number; placed: number; totalImpact: number; unreadNotifications: number } }>("/me"),

  // --- planets --------------------------------------------------------------
  planets: () => request<{ planets: PlanetSummary[] }>("/planets"),
  planet: (id: string) => request<{ planet: PlanetSummary }>(`/planets/${id}`),
  gridConfig: (id: string) =>
    request<{
      seed: string;
      latBands: number;
      lonBands: number;
      seaLevel: number;
      currentTick: number;
      currentYear: number;
      riverCount?: number;
      resourceDensity?: number;
      overlay: { owners: Record<number, string>; pollution: Record<number, number>; cities: CityMarker[] };
    }>(`/planets/${id}/grid-config`),
  region: (planetId: string, cell: number) =>
    request<RegionDetail>(`/planets/${planetId}/regions/${cell}`),
  events: (planetId: string, params = "") =>
    request<{ events: WorldEvent[]; total: number }>(`/planets/${planetId}/events${params}`),
  timeline: (planetId: string) => request<TimelineResponse>(`/planets/${planetId}/timeline`),
  stateSummary: (planetId: string) => request<StateSummary>(`/planets/${planetId}/state-summary`),
  scenarios: (planetId: string, body: { contributionId?: string; horizonTicks: number; runs: number }) =>
    request<{ report: ScenarioReport }>(`/planets/${planetId}/scenarios`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // --- contributions ----------------------------------------------------------
  analyze: (planetId: string, text: string, category: string | undefined, locale: string) =>
    request<AnalyzeResponse>(`/planets/${planetId}/contributions/analyze`, {
      method: "POST",
      body: JSON.stringify({ text, category, locale }),
    }),
  preview: (planetId: string, analysisId: string, cell: number, acceptBalanceSuggestion: boolean) =>
    request<PreviewResponse>(`/planets/${planetId}/contributions/preview`, {
      method: "POST",
      body: JSON.stringify({ analysisId, cell, acceptBalanceSuggestion }),
    }),
  place: (planetId: string, analysisId: string, cell: number, acceptBalanceSuggestion: boolean) =>
    request<{ contribution: Contribution; events: WorldEvent[] }>(`/planets/${planetId}/contributions/place`, {
      method: "POST",
      body: JSON.stringify({ analysisId, cell, acceptBalanceSuggestion }),
    }),
  impact: (planetId: string, contributionId: string) =>
    request<{ impact: { depth: number; eventCount: number; events: WorldEvent[]; links: { fromId: string; toId: string; mechanism: string }[] } }>(
      `/planets/${planetId}/contributions/${contributionId}/impact`,
    ),
  narrative: (planetId: string, contributionId: string, locale: string) =>
    request<{ narrative: string; eventIds: string[]; provider: string }>(
      `/planets/${planetId}/contributions/${contributionId}/narrative?locale=${locale}`,
    ),
  myContributions: () => request<{ contributions: Contribution[] }>("/me/contributions"),

  // --- notifications -----------------------------------------------------------
  notifications: () => request<{ notifications: Notification[]; unread: number }>("/me/notifications"),
  markNotificationRead: (id: string) =>
    request(`/me/notifications/${id}/read`, { method: "POST", body: "{}" }),
};

export interface CityMarker {
  id: string;
  cell: number;
  civId: string;
  name: string;
  population: number;
}

export interface AnalyzeResponse {
  analysisId: string;
  structured: StructuredContribution;
  balance: BalanceReport;
  provider: string;
  sandbox: boolean;
  flaggedForReview: boolean;
}

export interface PreviewResponse {
  viability: number;
  predictedEvents: WorldEvent[];
  environment: { biome: string; temperature: number; moisture: number; fertility: number };
}

export interface RegionDetail {
  cell: {
    index: number;
    lat: number;
    lon: number;
    biome: string;
    temperature: number;
    moisture: number;
    fertility: number;
    pollution: number;
    height: number;
    resources: { id: string; type: string; quantity: number; discovered: boolean }[];
  };
  owner: { id: string; name: string; color: string } | null;
  cities: { id: string; name: string; population: number }[];
  species: { id: string; name: string; diet: string; population: number }[];
  plants: { id: string; name: string; coverage: number }[];
  recentEvents: WorldEvent[];
}

export interface TimelineResponse {
  currentTick: number;
  currentYear: number;
  yearsPerTick: number;
  eras: { tick: number; year: number; count: number; types: Record<string, number>; highlights: string[] }[];
  snapshots: number[];
}

export interface StateSummary {
  tick: number;
  year: number;
  civilizations: { id: string; name: string; color: string; population: number; collapsed: boolean; techLevel: number; stability: number }[];
  cities: CityMarker[];
  activeWars: { id: string; attackerCivId: string; defenderCivId: string; cause: string; casualties: number; battles: number }[];
  alliances: { id: string; memberCivIds: string[]; reason: string }[];
  tradeRoutes: { id: string; fromCityId: string; toCityId: string; path: number[]; active: boolean }[];
  migrations: { id: string; fromCell: number; toCell: number; path: number[]; reason: string }[];
  luminescentCells: number[];
  stats: PlanetSummary["stats"];
}

export { BASE_URL };
