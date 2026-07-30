/** Shared, typed environment access with safe defaults for local dev. */

export interface ServiceEndpoints {
  apiUrl: string;
  engineUrl: string;
  orchestratorUrl: string;
  wsUrl: string;
}

export function env(key: string, fallback = ""): string {
  return (typeof process !== "undefined" ? process.env[key] : undefined) ?? fallback;
}

export function serviceEndpoints(): ServiceEndpoints {
  return {
    apiUrl: env("API_URL", "http://localhost:4000"),
    engineUrl: env("ENGINE_URL", "http://localhost:4100"),
    orchestratorUrl: env("ORCHESTRATOR_URL", "http://localhost:4200"),
    wsUrl: env("WS_URL", "ws://localhost:4000"),
  };
}

export const DEFAULT_WORLD_SEED = 20260730;
export const DEFAULT_WORLD_ID = "demo-world";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

export const EVENT_FEED_PAGE_SIZE = 40;
export const EVENT_FEED_RING_BUFFER = 5000;
