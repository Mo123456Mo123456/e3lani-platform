export type Role =
  | "guest"
  | "user"
  | "explorer"
  | "life_maker"
  | "civilization_creator"
  | "historian"
  | "moderator"
  | "content_moderator"
  | "simulation_manager"
  | "admin"
  | "system_admin"
  | "super_admin";

export type UserIdentity = {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
};

export type HealthStatus = {
  status: "ok" | "degraded" | string;
  sandboxMode: boolean;
  persistence: {
    kind: "postgresql" | "memory-sandbox" | string;
    ok?: boolean;
    latencyMs?: number;
    error?: string;
  };
  ai: {
    provider: string;
    model?: string;
    configured?: boolean;
    sandbox?: boolean;
    connectivity?: string;
  };
  eventBus: {
    kind: "in-process" | "nats" | string;
  };
};

export type PlanetSummary = {
  id: string;
  name: string;
  slug: string;
  currentTick: number;
  isPaused: boolean;
  stability: number;
  biodiversity: number;
  averageTemperature: number;
  population: number;
  counts: {
    regions: number;
    civilizations: number;
    cities: number;
    resources: number;
    species: number;
    plants: number;
    technologies: number;
  };
};

export type TimelineSnapshot = {
  id: string;
  planetId: string;
  tick: number;
  reason: string;
  state: Record<string, unknown>;
  createdAt: string;
};

type Page<T> = {
  items: T[];
  nextCursor?: string;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
  message?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!base) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL is not configured for the admin application.",
      0,
      "API_NOT_CONFIGURED",
    );
  }
  return `${base}${path}`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  acceptedErrorStatuses: number[] = [],
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("تعذر الاتصال بخدمة الكوكب.", 0, "NETWORK_ERROR");
  }

  if (!response.ok && !acceptedErrorStatuses.includes(response.status)) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(
      body.error?.message ?? body.message ?? `API request failed (${response.status}).`,
      response.status,
      body.error?.code,
      body.error?.requestId,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function parseCurrentUser(payload: unknown): UserIdentity {
  const value = payload as {
    user?: unknown;
    data?: unknown | { user?: unknown };
  };
  const candidate =
    value?.user ??
    (typeof value?.data === "object" && value.data !== null && "user" in value.data
      ? value.data.user
      : value?.data);

  if (!candidate || typeof candidate !== "object") {
    throw new ApiError("استجابة /auth/me لا تحتوي على هوية مستخدم صالحة.", 502, "INVALID_ME_RESPONSE");
  }

  const user = candidate as Partial<UserIdentity>;
  if (
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.displayName !== "string" ||
    !Array.isArray(user.roles) ||
    !user.roles.every((role) =>
      [
        "guest",
        "user",
        "explorer",
        "life_maker",
        "civilization_creator",
        "historian",
        "moderator",
        "content_moderator",
        "simulation_manager",
        "admin",
        "system_admin",
        "super_admin",
      ].includes(role),
    )
  ) {
    throw new ApiError("استجابة /auth/me لا تطابق عقد الهوية.", 502, "INVALID_ME_RESPONSE");
  }
  return user as UserIdentity;
}

export async function signIn(email: string, password: string): Promise<void> {
  await request("/auth/session", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getCurrentUser(): Promise<UserIdentity> {
  return parseCurrentUser(await request<unknown>("/auth/me"));
}

export async function signOut(): Promise<void> {
  await request("/auth/session", { method: "DELETE" });
}

export async function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/health", {}, [503]);
}

export async function getWorldSummary(): Promise<PlanetSummary> {
  const response = await request<{ data: PlanetSummary }>("/world/summary");
  return response.data;
}

export async function getTimeline(planetId: string): Promise<Page<TimelineSnapshot>> {
  const query = new URLSearchParams({ planetId, limit: "100" });
  const response = await request<{ data: Page<TimelineSnapshot> }>(
    `/world/timeline?${query.toString()}`,
  );
  return response.data;
}

export async function setSimulationPaused(
  planetId: string,
  paused: boolean,
): Promise<{ planetId: string; isPaused: boolean; tick: number }> {
  const action = paused ? "pause" : "resume";
  const response = await request<{
    data: { planetId: string; isPaused: boolean; tick: number };
  }>(`/admin/ticks/${action}`, {
    method: "POST",
    body: JSON.stringify({ planetId }),
  });
  return response.data;
}

export async function rollbackTimeline(
  planetId: string,
  tick: number,
): Promise<TimelineSnapshot> {
  const response = await request<{ data: TimelineSnapshot }>("/admin/snapshots/rollback", {
    method: "POST",
    body: JSON.stringify({ planetId, tick }),
  });
  return response.data;
}
