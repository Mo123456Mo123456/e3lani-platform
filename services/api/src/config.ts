import "dotenv/config";
import { z } from "zod";

const booleanFromString = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() === "true" : value),
  z.boolean(),
);

const configSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    DATABASE_URL: z.string().url().optional(),
    SANDBOX_MODE: booleanFromString.default(false),
    SANDBOX_ADMIN_KEY: z.string().min(16).optional(),
    JWT_SECRET: z.string().min(32).default("sandbox-only-secret-must-be-replaced"),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    AI_PROVIDER: z.enum(["mock", "openai", "anthropic", "gemini"]).default("mock"),
    AI_MODEL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    NATS_URL: z.string().optional(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((value, ctx) => {
    if (!value.SANDBOX_MODE && !value.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required unless SANDBOX_MODE=true",
      });
    }
    if (value.NODE_ENV === "production" && value.JWT_SECRET.includes("sandbox-only")) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "A unique JWT_SECRET is required in production",
      });
    }
    if (!value.SANDBOX_MODE && value.AI_PROVIDER === "mock") {
      ctx.addIssue({
        code: "custom",
        path: ["AI_PROVIDER"],
        message: "The mock AI provider is available only in sandbox mode",
      });
    }
  });

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl?: string | undefined;
  sandboxMode: boolean;
  sandboxAdminKey?: string | undefined;
  jwtSecret: string;
  corsOrigins: string[];
  aiProvider: "mock" | "openai" | "anthropic" | "gemini";
  aiModel?: string | undefined;
  openAiApiKey?: string | undefined;
  anthropicApiKey?: string | undefined;
  geminiApiKey?: string | undefined;
  natsUrl?: string | undefined;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const value = configSchema.parse(env);
  return {
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    sandboxMode: value.SANDBOX_MODE,
    sandboxAdminKey: value.SANDBOX_ADMIN_KEY,
    jwtSecret: value.JWT_SECRET,
    corsOrigins: value.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    aiProvider: value.AI_PROVIDER,
    aiModel: value.AI_MODEL,
    openAiApiKey: value.OPENAI_API_KEY,
    anthropicApiKey: value.ANTHROPIC_API_KEY,
    geminiApiKey: value.GEMINI_API_KEY,
    natsUrl: value.NATS_URL,
    logLevel: value.LOG_LEVEL,
  };
}
