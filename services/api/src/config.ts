import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://planet:planet@localhost:5432/planet"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  NATS_URL: z.string().default("nats://localhost:4222"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:3001"),
  JWT_SECRET: z
    .string()
    .min(32)
    .default("development-only-change-this-secret-12345"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  WORLD_SEED: z.string().min(3).default("kawkab-gaia-2026"),
  AUTO_MIGRATE: z.enum(["true", "false"]).default("true"),
  AI_PROVIDER: z
    .enum(["sandbox", "openai", "anthropic", "gemini", "local"])
    .default("sandbox"),
});

export const config = configSchema.parse(process.env);
if (
  config.NODE_ENV === "production" &&
  config.JWT_SECRET.startsWith("development-only")
) {
  throw new Error("JWT_SECRET must be replaced before production starts");
}
export type Config = z.infer<typeof configSchema>;
