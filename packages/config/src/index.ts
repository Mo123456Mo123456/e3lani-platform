import { z } from "zod";

/** Years represented by one tick for each duration. */
export const TICK_YEARS = { day: 1 / 365.25, month: 1 / 12, year: 1, decade: 10 } as const;

export const SIMULATION_DEFAULTS = {
  gridWidth: 144,
  gridHeight: 72,
  seaLevel: 0.0,
  snapshotInterval: 50,
  /** hard cap so no cell can support unlimited population */
  maxCellPopulation: 2_000_000,
  /** trait budget: sum of all trait values may not exceed this */
  traitBudget: 6.0,
  /** single-trait cap; nothing is perfect */
  traitCap: 0.98,
  initialCivilizations: 12,
  initialSpecies: 300,
  initialPlants: 800,
  techCount: 50,
} as const;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-only-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-only-refresh-secret-change-me"),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  AI_ORCHESTRATOR_URL: z.string().url().optional(),
  AI_PROVIDER: z.enum(["mock", "openai", "anthropic", "gemini"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3100"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
});

export type ServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServiceEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Which AI provider is effectively usable given keys; falls back to sandbox. */
export function resolveAiProvider(env: ServiceEnv): { provider: ServiceEnv["AI_PROVIDER"]; sandbox: boolean } {
  const requested = env.AI_PROVIDER;
  const hasKey =
    (requested === "openai" && !!env.OPENAI_API_KEY) ||
    (requested === "anthropic" && !!env.ANTHROPIC_API_KEY) ||
    (requested === "gemini" && !!env.GEMINI_API_KEY);
  if (requested === "mock" || !hasKey) {
    return { provider: "mock", sandbox: true };
  }
  return { provider: requested, sandbox: false };
}
