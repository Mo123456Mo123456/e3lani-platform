import { z } from "zod";

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  OTP_HASH_SECRET: z.string().min(32),
  OTP_PROVIDER: z.enum(["console", "unifonic"]).default("console"),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(8),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  PAYMENTS_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  PAYMENT_PROVIDER: z.enum(["disabled", "moyasar"]).default("disabled"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(env);
}
