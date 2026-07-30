import { z } from "zod";

const boolFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    if (typeof value === "boolean") return value;
    return value === "true" || value === "1";
  }, z.boolean());

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  ADMIN_PORT: z.coerce.number().int().positive().default(3001),
  REALTIME_PORT: z.coerce.number().int().positive().default(4010),
  DATABASE_URL: z.string().optional(),
  SQLITE_PATH: z.string().default("./data/kawkab.sqlite"),
  JWT_SECRET: z.string().default("dev-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-change-me"),
  SIMULATION_SEED: z.string().default("kawkab-rich-demo"),
  SIMULATION_TICK_MS: z.coerce.number().int().positive().default(2000),
  AI_PROVIDER: z.enum(["openai", "anthropic", "gemini", "mock"]).default("mock"),
  FEATURE_AI: boolFromEnv(true),
  FEATURE_MULTIPLAYER: boolFromEnv(true),
  FEATURE_ADMIN: boolFromEnv(true),
  FEATURE_COST_TRACKING: boolFromEnv(false)
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}

export const ports = {
  web: Number(process.env.WEB_PORT ?? 3000),
  admin: Number(process.env.ADMIN_PORT ?? 3001),
  api: Number(process.env.API_PORT ?? 4000),
  realtime: Number(process.env.REALTIME_PORT ?? 4010)
};

export const featureFlags = {
  ai: process.env.FEATURE_AI !== "false",
  multiplayer: process.env.FEATURE_MULTIPLAYER !== "false",
  admin: process.env.FEATURE_ADMIN !== "false",
  costTracking: process.env.FEATURE_COST_TRACKING === "true"
};
