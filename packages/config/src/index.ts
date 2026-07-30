import { z } from "zod";

export const BRAND = {
  nameAr: "إعلاني",
  nameEn: "E3lani",
  sloganAr: "منصة الإعلانات المرئية لكل شيء",
  sloganEn: "The visual advertising platform for everything",
  colors: {
    primary: "#FFC400",
    black: "#111111",
    white: "#FFFFFF",
    gray: "#F7F7F7",
  },
} as const;

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(300),
  OTP_PROVIDER: z.enum(["console", "sms"]).default("console"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(8),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  S3_PUBLIC_URL: z.string().url(),
  MEDIA_QUEUE_NAME: z.string().default("media-processing"),
  PAYMENT_PROVIDER: z.enum(["disabled", "moyasar", "hyperpay"]).default("disabled"),
});

export type ServerEnvironment = z.infer<typeof serverEnvSchema>;
