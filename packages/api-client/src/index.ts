/**
 * Typed API client shared by web and admin apps.
 * Handles auth headers, token refresh with single-flight, and errors.
 */
import type {
  AdminMetrics,
  AiRequestDto,
  AllianceDto,
  AuditLogDto,
  AuthResponse,
  BalanceReportDto,
  CausalChain,
  CausalGraphDto,
  CityDto,
  CivilizationDetail,
  CivilizationDto,
  ContributionAssessment,
  ContributionImpact,
  ModerationItemDto,
  NotificationDto,
  Paginated,
  PlanetSummary,
  PlantDto,
  RegionInfo,
  ScenarioReport,
  SnapshotCompare,
  SnapshotDto,
  SpeciesDto,
  StructuredContribution,
  TechnologyDto,
  TradeRouteDto,
  UserContributionDto,
  UserDto,
  WarDto,
  WorldEvent,
} from "@planet/shared-types";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  onTokens?: (tokens: { accessToken: string; refreshToken: string }) => void;
  onUnauthorized?: () => void;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = "ApiError";
  }
}

interface RefreshState {
  inflight: Promise<boolean> | null;
  refreshToken: string | null;
}

export function createApiClient(opts: ApiClientOptions) {
  const refreshState: RefreshState = { inflight: null, refreshToken: null };

  async function rawFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    const token = opts.getAccessToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${opts.baseUrl}${path}`, { ...init, headers });
    if (res.status === 401 && retry && refreshState.refreshToken) {
      const ok = await tryRefresh();
      if (ok) return rawFetch<T>(path, init, false);
      opts.onUnauthorized?.();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async function tryRefresh(): Promise<boolean> {
    if (!refreshState.inflight) {
      refreshState.inflight = (async () => {
        try {
          const res = await fetch(`${opts.baseUrl}/auth/refresh`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refreshToken: refreshState.refreshToken }),
          });
          if (!res.ok) return false;
          const data = (await res.json()) as AuthResponse;
          refreshState.refreshToken = data.tokens.refreshToken;
          opts.onTokens?.({
            accessToken: data.tokens.accessToken,
            refreshToken: data.tokens.refreshToken,
          });
          return true;
        } catch {
          return false;
        } finally {
          refreshState.inflight = null;
        }
      })();
    }
    return refreshState.inflight;
  }

  const get = <T>(path: string) => rawFetch<T>(path);
  const post = <T>(path: string, body?: unknown) =>
    rawFetch<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
  const patch = <T>(path: string, body?: unknown) =>
    rawFetch<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });

  return {
    setRefreshToken(token: string | null) {
      refreshState.refreshToken = token;
    },

    // ---- auth ----
    register: (input: { email: string; password: string; displayName: string; locale?: string }) =>
      post<AuthResponse>("/auth/register", input),
    login: (input: { email: string; password: string }) => post<AuthResponse>("/auth/login", input),
    loginOAuth: (provider: "google" | "apple", idToken: string) =>
      post<AuthResponse>("/auth/oauth", { provider, idToken }),
    logout: () => post<void>("/auth/logout"),
    me: () => get<UserDto>("/users/me"),

    // ---- planet & regions ----
    getPlanet: () => get<PlanetSummary>("/planets/current"),
    getRegion: (planetId: string, cellId: number) =>
      get<RegionInfo>(`/planets/${planetId}/regions/${cellId}`),
    getMapLayer: (planetId: string, layer: string) =>
      get<{ layer: string; pngBase64: string; tick: number }>(`/planets/${planetId}/maps/${layer}`),
    getOverlays: (planetId: string) =>
      get<{
        cities: CityDto[];
        tradeRoutes: TradeRouteDto[];
        wars: WarDto[];
        migrations: Array<{ fromCell: number; toCell: number; size: number; tick: number }>;
      }>(`/planets/${planetId}/overlays`),

    // ---- entities ----
    getCivilizations: (planetId: string) => get<CivilizationDto[]>(`/planets/${planetId}/civilizations`),
    getCivilization: (planetId: string, civId: string) =>
      get<CivilizationDetail>(`/planets/${planetId}/civilizations/${civId}`),
    getSpecies: (planetId: string, page = 1) =>
      get<Paginated<SpeciesDto>>(`/planets/${planetId}/species?page=${page}`),
    getPlants: (planetId: string, page = 1) =>
      get<Paginated<PlantDto>>(`/planets/${planetId}/plants?page=${page}`),
    getTechnologies: (planetId: string) => get<TechnologyDto[]>(`/planets/${planetId}/technologies`),
    getAlliances: (planetId: string) => get<AllianceDto[]>(`/planets/${planetId}/alliances`),
    getWars: (planetId: string) => get<WarDto[]>(`/planets/${planetId}/wars`),
    getTradeRoutes: (planetId: string) => get<TradeRouteDto[]>(`/planets/${planetId}/trade-routes`),

    // ---- events & timeline ----
    getEvents: (planetId: string, params: Record<string, string | number | undefined> = {}) => {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
      return get<Paginated<WorldEvent>>(`/planets/${planetId}/events${qs ? `?${qs}` : ""}`);
    },
    getEventChain: (planetId: string, eventId: string) =>
      get<CausalChain>(`/planets/${planetId}/events/${eventId}/chain`),
    getTimeline: (planetId: string) => get<{ eras: Array<{ fromTick: number; toTick: number; label: string; eventCount: number }> }>(`/planets/${planetId}/timeline`),
    getSnapshots: (planetId: string) => get<SnapshotDto[]>(`/planets/${planetId}/snapshots`),
    compareSnapshots: (planetId: string, fromTick: number, toTick: number) =>
      get<SnapshotCompare>(`/planets/${planetId}/snapshots/compare?from=${fromTick}&to=${toTick}`),

    // ---- contribution wizard ----
    createContributionDraft: (input: { planetId: string; text: string; category?: string }) =>
      post<UserContributionDto>("/contributions/drafts", input),
    analyzeContribution: (id: string) =>
      post<{
        contribution: StructuredContribution;
        balance: BalanceReportDto;
        graph: CausalGraphDto | null;
        sandbox: boolean;
        provider: string;
      }>(`/contributions/${id}/analyze`),
    assessContribution: (id: string, targetCellId?: number | null) =>
      post<ContributionAssessment>(`/contributions/${id}/assess`, { targetCellId }),
    previewContribution: (id: string, input: { horizons?: number[]; runs?: number; targetCellId?: number | null }) =>
      post<{ jobId: string }>(`/contributions/${id}/preview`, input),
    getPreviewResult: (id: string) =>
      get<{ status: string; report?: ScenarioReport }>(`/contributions/${id}/preview`),
    confirmContribution: (id: string, input: { targetCellId?: number | null; finalName?: string; finalTraits?: Record<string, number | string> }) =>
      post<{ contribution: UserContributionDto; narrative: string; events: WorldEvent[] }>(
        `/contributions/${id}/confirm`,
        input,
      ),
    myContributions: () => get<UserContributionDto[]>("/contributions/mine"),
    getContribution: (id: string) => get<UserContributionDto>(`/contributions/${id}`),
    getContributionImpact: (id: string) => get<ContributionImpact>(`/contributions/${id}/impact`),

    // ---- notifications ----
    getNotifications: () => get<NotificationDto[]>("/notifications"),
    markNotificationRead: (id: string) => post<void>(`/notifications/${id}/read`),

    // ---- analytics ----
    trackBatch: (events: Array<{ name: string; props?: Record<string, string | number | boolean> }>) =>
      post<void>("/analytics/batch", { events }),

    // ---- admin ----
    adminMetrics: () => get<AdminMetrics>("/admin/metrics"),
    adminUsers: (page = 1) => get<Paginated<UserDto>>(`/admin/users?page=${page}`),
    adminUpdateUser: (id: string, input: { role?: string; suspended?: boolean }) =>
      patch<UserDto>(`/admin/users/${id}`, input),
    adminSimControl: (planetId: string, input: { action: string; ticks?: number; snapshotId?: string }) =>
      post<{ status: string; tick: number }>(`/admin/planets/${planetId}/simulation`, input),
    adminAiRequests: (page = 1) => get<Paginated<AiRequestDto>>(`/admin/ai-requests?page=${page}`),
    adminAuditLogs: (page = 1) => get<Paginated<AuditLogDto>>(`/admin/audit-logs?page=${page}`),
    adminModerationQueue: () => get<ModerationItemDto[]>("/admin/moderation"),
    adminModerationReview: (id: string, decision: "approve" | "reject", note?: string) =>
      post<void>(`/admin/moderation/${id}/review`, { decision, note }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
