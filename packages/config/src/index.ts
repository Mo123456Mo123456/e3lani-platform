import { z } from "zod";

/**
 * Environment schema for node services. Read once at bootstrap;
 * invalid config fails fast with a readable report.
 */
const boolFromEnv = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((v) => v === true || v === "true");

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional().default(""),
  NATS_URL: z.string().optional().default(""),

  SIMULATION_ENGINE_URL: z.string().default("http://localhost:8001"),
  AI_ORCHESTRATOR_URL: z.string().default("http://localhost:8002"),
  WEB_URL: z.string().default("http://localhost:3000"),
  ADMIN_URL: z.string().default("http://localhost:3001"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().default(2592000),
  COOKIE_SECURE: boolFromEnv.default("false"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  APPLE_CLIENT_ID: z.string().optional().default(""),
  APPLE_CLIENT_SECRET: z.string().optional().default(""),

  SIM_TICK_SECONDS: z.coerce.number().default(5),
  SIM_YEARS_PER_TICK: z.coerce.number().default(1),
  SIM_DEFAULT_SEED: z.coerce.number().int().default(42),
  SIM_AUTO_RUN: boolFromEnv.default("false"),

  AI_PROVIDER_DEFAULT: z.string().default("mock"),
  AI_MONTHLY_COST_BUDGET_USD: z.coerce.number().default(50),

  SEED_SUPER_ADMIN_EMAIL: z.string().default("admin@planet.local"),
  SEED_SUPER_ADMIN_PASSWORD: z.string().default("PlanetAdmin!234"),
  SEED_DEMO_USER_EMAIL: z.string().default("demo@planet.local"),
  SEED_DEMO_USER_PASSWORD: z.string().default("PlanetDemo!234"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = apiEnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid API environment:\n${problems}`);
  }
  return parsed.data;
}
