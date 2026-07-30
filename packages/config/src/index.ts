import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
  ADMIN_URL: z.string().default("http://localhost:3001"),
  API_URL: z.string().default("http://localhost:4000"),
  AI_ORCHESTRATOR_URL: z.string().default("http://localhost:5001"),
  SIMULATION_ENGINE_URL: z.string().default("http://localhost:4001"),
  DATABASE_URL: z
    .string()
    .default("postgresql://planet:planet_dev@localhost:5432/planet_born"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16).default("dev-only-change-me-planet-born-32"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  DEFAULT_PLANET_SEED: z.coerce.number().default(42424242),
  DEFAULT_TICK_UNIT: z.enum(["day", "month", "year", "decade"]).default("year"),
  AI_PROVIDER: z.enum(["sandbox", "openai", "anthropic", "gemini"]).default("sandbox"),
  AI_SANDBOX_MODE: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  OPENAI_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  SUPER_ADMIN_EMAIL: z.string().default("admin@planet-born.local"),
  SUPER_ADMIN_PASSWORD: z.string().default("PlanetAdmin!2026"),
  SUPER_ADMIN_NAME: z.string().default("Super Admin"),
  DEMO_USER_EMAIL: z.string().default("explorer@planet-born.local"),
  DEMO_USER_PASSWORD: z.string().default("Explorer!2026"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  OTEL_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export const BRAND = {
  nameAr: "كوكب يولد أمامك",
  nameEn: "Planet Born Before You",
  taglineAr: "عالمك، قرارك، أثر لا ينتهي.",
  taglineEn: "Your world, your choice, an endless impact.",
  colors: {
    bg: "#050a14",
    bgElevated: "#0b1526",
    cyan: "#3ecbff",
    green: "#3dff9a",
    gold: "#f0c14b",
    purple: "#b07cff",
    red: "#ff4d6d",
    orange: "#ff8a3d",
    white: "#f2f5f8",
    gray: "#8b98a8",
  },
} as const;
