import { getAuthToken } from "@/stores/auth-store";
import type {
  AuthResponse,
  ContributionAnalysis,
  ContributionResult,
  ElementCategory,
  PlanetDto,
  TimelineMilestone,
  UserImpactStats,
  WorldEventDto,
} from "@/types/domain";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = RequestInit & {
  auth?: boolean;
};

function normalizeApiUrl(path: string) {
  const base = API_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json().catch(() => undefined) : await response.text().catch(() => "");

  if (!response.ok) {
    const messageSource =
      body && typeof body === "object" && "message" in body ? (body as { message?: string | string[] }).message : undefined;
    const message = Array.isArray(messageSource)
      ? messageSource.join(", ")
      : messageSource || `API request failed with status ${response.status}`;

    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false) {
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(normalizeApiUrl(path), {
    ...options,
    headers,
  });

  return parseResponse<T>(response);
}

export async function login(payload: { email: string; password: string }) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: false,
  });
}

export async function register(payload: { email: string; password: string; displayName: string }) {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: false,
  });
}

export async function getDefaultPlanet() {
  return apiFetch<PlanetDto>("/planets/default", { auth: false });
}

export async function getPlanetEvents(planetId: string) {
  return apiFetch<WorldEventDto[]>(`/planets/${planetId}/events`, { auth: false });
}

export async function getPlanetTimeline(planetId: string) {
  return apiFetch<TimelineMilestone[]>(`/planets/${planetId}/timeline`, { auth: false });
}

export async function analyzeContribution(payload: {
  planetId: string;
  category: ElementCategory;
  idea: string;
  locale: "ar" | "en";
}) {
  return apiFetch<ContributionAnalysis>("/contributions/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createContribution(payload: {
  planetId: string;
  category: ElementCategory;
  idea: string;
  regionId: string;
  analysisId?: string;
  structuredElement?: unknown;
}) {
  return apiFetch<ContributionResult>("/contributions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyImpact() {
  return apiFetch<UserImpactStats>("/me/impact");
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown API error";
}
