import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_PROVIDER: z.enum(["console", "sms"]).default("console"),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  OTP_RESEND_SECONDS: z.coerce.number().int().min(30).default(60),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanString,
  MEDIA_PUBLIC_URL: z.string().url(),
  PAYMENTS_ENABLED: booleanString,
  PAYMENT_PROVIDER: z.enum(["disabled", "moyasar", "hyperpay"]).default("disabled"),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:3001")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${fields}`);
  }
  if (parsed.data.PAYMENTS_ENABLED && parsed.data.PAYMENT_PROVIDER === "disabled") {
    throw new Error("PAYMENT_PROVIDER must be configured when PAYMENTS_ENABLED=true");
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.OTP_PROVIDER === "console") {
    throw new Error("OTP_PROVIDER=console is forbidden in production");
  }
  return parsed.data;
}
