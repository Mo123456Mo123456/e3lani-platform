import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type FetchOptions = RequestInit & { auth?: boolean; json?: unknown };

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers || {});
  if (opts.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (opts.auth !== false) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error || res.statusText || "Request failed",
      res.status,
      data,
    );
  }
  return data as T;
}

export const api = {
  getPlanets: () => apiFetch<{ planets: PlanetRow[] }>("/planets", { auth: false }),
  getPlanet: (id: string) =>
    apiFetch<{
      planet: PlanetRow;
      stats: Record<string, number>;
      civilizations: CivRow[];
    }>(`/planets/${id}`, { auth: false }),
  getRegions: (planetId: string) =>
    apiFetch<{ regions: RegionRow[]; biomes: BiomeRow[] }>(`/planets/${planetId}/regions`, {
      auth: false,
    }),
  getEvents: (planetId: string, limit = 50) =>
    apiFetch<{ events: EventRow[]; causalLinks: CausalRow[] }>(
      `/planets/${planetId}/events?limit=${limit}`,
      { auth: false },
    ),
  getEvent: (id: string) =>
    apiFetch<{ event: EventRow; causes: CausalRow[]; effects: CausalRow[] }>(`/events/${id}`, {
      auth: false,
    }),
  getTimeline: (planetId: string) =>
    apiFetch<{ snapshots: TimelineSnap[]; ticks: TickRow[] }>(`/planets/${planetId}/timeline`, {
      auth: false,
    }),
  getSpecies: (planetId: string) =>
    apiFetch<{ species: SpeciesRow[] }>(`/planets/${planetId}/species?limit=100`, { auth: false }),
  getPlants: (planetId: string) =>
    apiFetch<{ plants: { id: string; name: string; status?: string; coverage?: number }[] }>(
      `/planets/${planetId}/plants?limit=100`,
      { auth: false },
    ),
  getResources: (planetId: string) =>
    apiFetch<{ resources: { id: string; name: string; type: string; abundance: number }[] }>(
      `/planets/${planetId}/resources?limit=100`,
      { auth: false },
    ),
  getTechnologies: (planetId: string) =>
    apiFetch<{ technologies: { id: string; name: string; category: string; level: number }[] }>(
      `/planets/${planetId}/technologies`,
      { auth: false },
    ),
  getAlliances: (planetId: string) =>
    apiFetch<{ alliances: { id: string; name: string; strength: number; status: string }[] }>(
      `/planets/${planetId}/alliances`,
      { auth: false },
    ),
  getCivilizations: (planetId: string) =>
    apiFetch<{ civilizations: CivRow[] }>(`/planets/${planetId}/civilizations`, { auth: false }),
  login: (email: string, password: string) =>
    apiFetch<{
      user: { id: string; email: string; displayName: string; roles?: string[] };
      accessToken: string;
      refreshToken: string;
    }>("/auth/login", { method: "POST", json: { email, password }, auth: false }),
  register: (email: string, password: string, displayName: string) =>
    apiFetch<{
      user: { id: string; email: string; displayName: string; roles?: string[] };
      accessToken: string;
      refreshToken: string;
    }>("/auth/register", {
      method: "POST",
      json: { email, password, displayName },
      auth: false,
    }),
  me: () => apiFetch<{ id: string; email: string; roles: string[] }>("/auth/me"),
  getNotifications: () =>
    apiFetch<{ notifications: NotificationRow[] }>("/notifications"),
  getContributions: () =>
    apiFetch<{ contributions: ContributionRow[] }>("/contributions"),
  analyzeContribution: (body: AnalyzeBody) =>
    apiFetch<{
      analysis: AnalysisResult;
      balanceScore: number;
      sandbox: boolean;
      balanceHints: string[];
    }>("/contributions/analyze", { method: "POST", json: body }),
  createContribution: (body: CreateContributionBody) =>
    apiFetch<ContributionResult>("/contributions", { method: "POST", json: body }),
  injectContribution: (id: string) =>
    apiFetch<InjectResult>(`/contributions/${id}/inject`, { method: "POST", json: {} }),
  forecastContribution: (id: string, years = 50) =>
    apiFetch<ForecastResult>(`/contributions/${id}/forecast`, {
      method: "POST",
      json: { years },
    }),
};

export type PlanetRow = {
  id: string;
  name: string;
  seed: string;
  ageYears: number;
  currentTick: number;
  resolution: number;
};

export type RegionRow = {
  id: string;
  planetId: string;
  name: string;
  x: number;
  y: number;
  elevation: number;
  moisture: number;
  temperature: number;
  biomeId?: string | null;
};

export type BiomeRow = {
  id: string;
  name: string;
  code: string;
  color?: string | null;
  habitability: number;
};

export type EventRow = {
  id: string;
  planetId: string;
  tick: number;
  type: string;
  title: string;
  description?: string | null;
  severity?: number | null;
  actors?: unknown;
  payload?: Record<string, unknown>;
  contributionId?: string | null;
  createdAt?: string;
};

export type CausalRow = {
  id: string;
  planetId: string;
  causeEventId: string;
  effectEventId: string;
  relation: string;
  strength: number;
  explanation?: string | null;
};

export type TimelineSnap = {
  id: string;
  planetId: string;
  tick: number;
  label: string;
  eventCount?: number;
};

export type TickRow = {
  id: string;
  planetId: string;
  tick: number;
  year: number;
};

export type CivRow = {
  id: string;
  name: string;
  population?: number;
  techLevel?: number;
  planetId: string;
};

export type SpeciesRow = {
  id: string;
  name: string;
  population?: number;
  planetId: string;
  traits?: Record<string, unknown>;
};

export type NotificationRow = {
  id: string;
  title: string;
  body?: string | null;
  type: string;
  read: boolean;
  createdAt?: string;
};

export type ContributionRow = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  status: string;
  balanceScore?: number | null;
  createdAt?: string;
};

export type AnalyzeBody = {
  planetId?: string;
  type: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
};

export type AnalysisResult = {
  type: string;
  title: string;
  traits: Record<string, unknown>;
  balanceHints: string[];
  risk: number;
  structured: Record<string, unknown>;
  provider: string;
};

export type CreateContributionBody = {
  planetId: string;
  type: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  inject?: boolean;
};

export type ContributionResult = {
  id: string;
  status: string;
  analysis?: AnalysisResult;
  balanceScore?: number;
  preview?: { events: unknown[]; year: number };
  moderation?: { status: string };
};

export type InjectResult = {
  id: string;
  status: string;
  tick?: number;
  year?: number;
  events?: EventRow[];
  eventIds?: string[];
};

export type ForecastResult = {
  contributionId: string;
  years: number;
  monteCarloRuns: number;
  mostLikely: ForecastScenario;
  best: ForecastScenario;
  worst: ForecastScenario;
  uncertainty: number;
  sandbox?: boolean;
};

export type ForecastScenario = {
  label: string;
  probability: number;
  events: unknown[];
  metrics: Record<string, number>;
};

export { API_URL };
