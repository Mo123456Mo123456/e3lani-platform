import type {
  AnalyzedContribution,
  AuthUser,
  ContributionPreview,
  PlanetBootstrap,
  WorldEvent,
} from "@living-planet/shared-types";

export const DEFAULT_PLANET_ID = "00000000-0000-4000-8000-000000000001";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) window.sessionStorage.setItem("planet_access", token);
    else window.sessionStorage.removeItem("planet_access");
  }
}

function storedToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") accessToken = window.sessionStorage.getItem("planet_access");
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = storedToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(
      typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "Request failed",
      response.status,
      body,
    );
  }
  return body as T;
}

export const planetApi = {
  bootstrap: () => api<PlanetBootstrap>(`/v1/planets/${DEFAULT_PLANET_ID}/bootstrap`),
  login: (email: string, password: string) =>
    api<{ user: AuthUser; accessToken: string }>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).then((result) => {
      setAccessToken(result.accessToken);
      return result.user;
    }),
  register: (email: string, password: string, displayName: string) =>
    api<{ user: AuthUser; accessToken: string }>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }).then((result) => {
      setAccessToken(result.accessToken);
      return result.user;
    }),
  refresh: () =>
    api<{ user: AuthUser; accessToken: string }>("/v1/auth/refresh", { method: "POST" }).then((result) => {
      setAccessToken(result.accessToken);
      return result.user;
    }),
  logout: () => api<void>("/v1/auth/logout", { method: "POST" }).finally(() => setAccessToken(null)),
  analyze: (category: string, idea: string, locale: "ar" | "en") =>
    api<AnalyzedContribution>("/v1/contributions/analyze", {
      method: "POST",
      body: JSON.stringify({ category, idea, locale }),
    }),
  preview: (regionId: string, contribution: AnalyzedContribution) =>
    api<ContributionPreview>("/v1/contributions/preview", {
      method: "POST",
      body: JSON.stringify({ planetId: DEFAULT_PLANET_ID, regionId, contribution }),
    }),
  confirm: (
    regionId: string,
    contribution: AnalyzedContribution,
    originalIdea: string,
    idempotencyKey: string,
  ) =>
    api<{ contributionId: string; event: WorldEvent }>("/v1/contributions", {
      method: "POST",
      body: JSON.stringify({
        planetId: DEFAULT_PLANET_ID,
        regionId,
        contribution,
        originalIdea,
        idempotencyKey,
      }),
    }),
};
