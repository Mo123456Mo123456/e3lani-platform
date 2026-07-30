/**
 * @planet/config — typed, validated environment configuration.
 * Every service parses its env through here; missing optional external keys
 * fall back to documented sandbox behavior rather than crashing.
 */
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((v) => v === "true" || v === "1");

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().default(4100),
  HOST: z.string().default("0.0.0.0"),

  /** When empty, the API uses the in-memory repository (dev/sandbox). */
  DATABASE_URL: z.string().default(""),
  REDIS_URL: z.string().default(""),
  NATS_URL: z.string().default(""),

  JWT_SECRET: z.string().min(16).default("dev-only-insecure-secret-change-me"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().default(60 * 60 * 24 * 30),

  /** External AI orchestrator (FastAPI). Empty => built-in sandbox analyzer. */
  AI_ORCHESTRATOR_URL: z.string().default(""),
  AI_PROVIDER: z
    .enum(["mock", "openai", "anthropic", "gemini"])
    .default("mock"),

  /** External scientific simulation service (FastAPI). Empty => in-process. */
  SIM_ENGINE_URL: z.string().default(""),

  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3100"),
  RATE_LIMIT_MAX: z.coerce.number().int().default(120),

  /** Default planet created on boot when the store is empty. */
  DEFAULT_PLANET_SEED: z.string().default("planet-genesis-prime"),
  YEARS_PER_TICK: z.coerce.number().int().default(5),
  AUTO_TICK: bool,
  AUTO_TICK_INTERVAL_MS: z.coerce.number().int().default(4000),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = apiEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid API environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }
  if (
    parsed.data.NODE_ENV === "production" &&
    parsed.data.JWT_SECRET === "dev-only-insecure-secret-change-me"
  ) {
    throw new Error("JWT_SECRET must be set explicitly in production");
  }
  return parsed.data;
}
