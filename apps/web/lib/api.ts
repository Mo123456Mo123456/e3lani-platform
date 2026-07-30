import {
  adaptAnalysis,
  adaptCommit,
  adaptEvents,
  adaptPreview,
  adaptRegion,
  composeWorldSnapshot,
} from "./adapters";
import type {
  ApiAnalysisResponse,
  ApiAuthResponse,
  ApiCommitResponse,
  ApiEnvelope,
  ApiPage,
  ApiPlanetSummary,
  ApiPreviewResponse,
  ApiTimelineSnapshot,
  ApiUser,
  ApiWorldEvent,
  ApiWorldRegion,
} from "./api-contract";
import {
  analyzeSandboxContribution,
  commitSandboxContribution,
  getSandboxEvents,
  getSandboxWorld,
  previewSandboxContribution,
} from "./sandbox";
import type {
  ApiErrorBody,
  AuthUser,
  ContributionAnalysis,
  ContributionRequest,
  ContributionResult,
  SimulationForecast,
  WorldEvent,
  WorldSnapshot,
} from "./types";

const browserSandboxEnabled = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";
const sandboxRegistrationEnabled =
  browserSandboxEnabled ||
  process.env.NEXT_PUBLIC_ALLOW_SANDBOX_REGISTRATION === "true";
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(
  /\/+$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : undefined);

export type ApiMode = "sandbox" | "production" | "misconfigured";

export function getApiMode(): ApiMode {
  if (browserSandboxEnabled) return "sandbox";
  return apiBaseUrl ? "production" : "misconfigured";
}

export function getApiBaseUrl(): string | undefined {
  return apiBaseUrl;
}

export function isBrowserSandbox(): boolean {
  return browserSandboxEnabled;
}

export function isSandboxRegistrationAllowed(): boolean {
  return sandboxRegistrationEnabled;
}

const localSandboxUser: AuthUser = {
  id: "browser-sandbox-user",
  email: "sandbox@local.invalid",
  displayName: "مستكشف Sandbox",
  roles: ["user"],
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiClientError(
      "NEXT_PUBLIC_API_URL is required when sandbox mode is disabled.",
      0,
      "API_NOT_CONFIGURED",
    );
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiClientError(
      "The world service could not be reached. No synthetic data was substituted.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiClientError(
      body.error?.message ??
        body.message ??
        `The world service returned HTTP ${response.status}.`,
      response.status,
      body.error?.code ?? body.code,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function queryString(
  values: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : "";
}

async function allPages<T>(
  path: string,
  planetId: string,
  maxPages = 20,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const response = await request<ApiEnvelope<ApiPage<T>>>(
      `${path}${queryString({ planetId, limit: 100, cursor })}`,
    );
    items.push(...response.data.items);
    cursor = response.data.nextCursor;
    if (!cursor) break;
  }
  return items;
}

async function getProductionWorld(): Promise<WorldSnapshot> {
  const summaryResponse =
    await request<ApiEnvelope<ApiPlanetSummary>>("/world/summary");
  const summary = summaryResponse.data;
  const [regions, timeline] = await Promise.all([
    allPages<ApiWorldRegion>("/world/regions", summary.id),
    allPages<ApiTimelineSnapshot>("/world/timeline", summary.id),
  ]);
  return composeWorldSnapshot(summary, regions, timeline);
}

function authUser(response: ApiAuthResponse): AuthUser {
  return {
    ...response.user,
    sessionExpiresAt: response.session.expiresAt,
  };
}

function parseMeResponse(value: unknown): AuthUser | undefined {
  if (!value || typeof value !== "object") return undefined;
  const root = value as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const candidate =
    nested.user && typeof nested.user === "object"
      ? (nested.user as ApiUser)
      : (nested as unknown as ApiUser);
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.email !== "string" ||
    typeof candidate.displayName !== "string" ||
    !Array.isArray(candidate.roles)
  ) {
    return undefined;
  }
  return candidate;
}

export const authApi = {
  async me(): Promise<AuthUser> {
    if (browserSandboxEnabled) return localSandboxUser;
    try {
      const response = await request<unknown>("/auth/me");
      const user = parseMeResponse(response);
      if (!user) {
        throw new ApiClientError(
          "The session endpoint returned an invalid identity.",
          502,
          "INVALID_AUTH_RESPONSE",
        );
      }
      return user;
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 404)
        throw error;
      await request<ApiEnvelope<ApiPlanetSummary>>("/world/summary");
      return {
        id: "cookie-session",
        email: "",
        displayName: "Planet contributor",
        roles: ["user"],
      };
    }
  },

  async login(email: string, password: string): Promise<AuthUser> {
    if (browserSandboxEnabled) {
      if (!email.trim() || !password) {
        throw new ApiClientError(
          "Sandbox login still requires non-empty credentials.",
          400,
          "SANDBOX_VALIDATION_ERROR",
        );
      }
      return { ...localSandboxUser, email: email.trim() };
    }
    const response = await request<ApiAuthResponse>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return authUser(response);
  },

  async createSandboxAccount(input: {
    email: string;
    displayName: string;
    password: string;
  }): Promise<AuthUser> {
    if (browserSandboxEnabled) {
      return {
        ...localSandboxUser,
        email: input.email.trim(),
        displayName: input.displayName.trim(),
      };
    }
    const response = await request<ApiAuthResponse>("/auth/sandbox", {
      method: "POST",
      body: JSON.stringify({ ...input, requestedRole: "user" }),
    });
    return authUser(response);
  },

  logout(): Promise<void> {
    if (browserSandboxEnabled) return Promise.resolve();
    return request<void>("/auth/session", { method: "DELETE" });
  },
};

export const worldApi = {
  getWorld(): Promise<WorldSnapshot> {
    return browserSandboxEnabled ? getSandboxWorld() : getProductionWorld();
  },

  async getEvents(): Promise<WorldEvent[]> {
    if (browserSandboxEnabled) return getSandboxEvents();
    const summaryResponse =
      await request<ApiEnvelope<ApiPlanetSummary>>("/world/summary");
    const [events, regions] = await Promise.all([
      allPages<ApiWorldEvent>("/world/events", summaryResponse.data.id),
      allPages<ApiWorldRegion>("/world/regions", summaryResponse.data.id),
    ]);
    return adaptEvents(events, regions.map(adaptRegion));
  },

  async analyze(input: ContributionRequest): Promise<ContributionAnalysis> {
    if (browserSandboxEnabled) return analyzeSandboxContribution(input);
    const response = await request<ApiEnvelope<ApiAnalysisResponse>>(
      "/contribution/analyze",
      {
        method: "POST",
        body: JSON.stringify({
          planetId: input.planetId,
          proposal: input.proposal,
          ...(input.regionId
            ? { clientContext: { regionId: input.regionId } }
            : {}),
        }),
      },
    );
    return adaptAnalysis(
      response.data.analysis,
      response.data.provider.provider,
    );
  },

  async preview(input: ContributionRequest): Promise<SimulationForecast> {
    if (browserSandboxEnabled) return previewSandboxContribution(input);
    const response = await request<ApiEnvelope<ApiPreviewResponse>>(
      "/contribution/preview",
      {
        method: "POST",
        body: JSON.stringify({
          planetId: input.planetId,
          proposal: input.proposal,
          samples: 250,
          ...(input.regionId
            ? { clientContext: { regionId: input.regionId } }
            : {}),
        }),
      },
    );
    return adaptPreview(response.data);
  },

  async commit(
    input: ContributionRequest,
    idempotencyKey: string,
  ): Promise<ContributionResult> {
    if (browserSandboxEnabled) return commitSandboxContribution(input);
    const response = await request<ApiEnvelope<ApiCommitResponse>>(
      "/contribution/commit",
      {
        method: "POST",
        body: JSON.stringify({
          planetId: input.planetId,
          proposal: input.proposal,
          idempotencyKey,
          ...(input.regionId
            ? { clientContext: { regionId: input.regionId } }
            : {}),
        }),
      },
    );
    return adaptCommit(response.data, input);
  },
};
