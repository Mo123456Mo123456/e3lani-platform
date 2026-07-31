import { z } from 'zod';

/** التحقق من متغيرات البيئة عند الإقلاع — الخدمة ترفض العمل بإعدادات ناقصة. */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === 'true' || value === '1');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().default(4000),
    API_PREFIX: z.string().default('api'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),

    DATABASE_URL: z.string().min(10),
    REDIS_URL: z.string().min(6),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ADMIN_JWT_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.coerce.number().int().default(900),
    JWT_REFRESH_TTL: z.coerce.number().int().default(2_592_000),
    ADMIN_JWT_TTL: z.coerce.number().int().default(28_800),

    OTP_PROVIDER: z.enum(['console', 'taqnyat', 'unifonic', 'msegat']).default('console'),
    OTP_LENGTH: z.coerce.number().int().min(4).max(6).default(4),
    OTP_TTL_SECONDS: z.coerce.number().int().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().default(5),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().default(60),
    OTP_SENDER_NAME: z.string().default('E3lani'),
    TAQNYAT_API_KEY: z.string().optional(),
    TAQNYAT_SENDER: z.string().optional(),
    UNIFONIC_APP_SID: z.string().optional(),
    UNIFONIC_SENDER_ID: z.string().optional(),
    MSEGAT_USERNAME: z.string().optional(),
    MSEGAT_API_KEY: z.string().optional(),
    MSEGAT_SENDER: z.string().optional(),

    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('e3lani-media'),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: booleanish.default(true),
    S3_PUBLIC_URL: z.string().min(4),
    S3_UPLOAD_URL_TTL: z.coerce.number().int().default(900),

    MEDIA_MAX_IMAGE_BYTES: z.coerce.number().int().default(10 * 1024 * 1024),
    MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().default(100 * 1024 * 1024),
    MEDIA_MAX_VIDEO_SECONDS: z.coerce.number().int().default(60),
    MEDIA_MAX_IMAGES_PER_AD: z.coerce.number().int().default(5),

    PAYMENTS_ENABLED: booleanish.default(false),
    PAYMENT_PROVIDER: z.enum(['sandbox', 'moyasar', 'tap', 'hyperpay']).default('sandbox'),
    PAYMENT_CURRENCY: z.string().default('SAR'),
    PAYMENT_RETURN_URL: z.string().default('http://localhost:3000/payments/callback'),
    MOYASAR_SECRET_KEY: z.string().optional(),
    MOYASAR_WEBHOOK_SECRET: z.string().optional(),
    TAP_SECRET_KEY: z.string().optional(),
    TAP_WEBHOOK_SECRET: z.string().optional(),
    HYPERPAY_ENTITY_ID: z.string().optional(),
    HYPERPAY_ACCESS_TOKEN: z.string().optional(),

    PUSH_PROVIDER: z.enum(['none', 'expo', 'fcm']).default('expo'),
    EXPO_ACCESS_TOKEN: z.string().optional(),

    RATE_LIMIT_TTL: z.coerce.number().int().default(60),
    RATE_LIMIT_LIMIT: z.coerce.number().int().default(120),
    RATE_LIMIT_AUTH_LIMIT: z.coerce.number().int().default(10),

    NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.PAYMENTS_ENABLED && env.PAYMENT_PROVIDER === 'sandbox') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PAYMENT_PROVIDER'],
          message: 'لا يُسمح بمزوّد الدفع التجريبي (sandbox) في بيئة الإنتاج.',
        });
      }
      if (env.OTP_PROVIDER === 'console') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OTP_PROVIDER'],
          message: 'لا يُسمح بمزوّد OTP التجريبي (console) في بيئة الإنتاج.',
        });
      }
      const weak = ['change-me', 'secret', 'test'];
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ADMIN_JWT_SECRET'] as const) {
        if (weak.some((word) => env[key].toLowerCase().includes(word))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `القيمة الافتراضية لـ ${key} غير مسموح بها في الإنتاج.`,
          });
        }
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`إعدادات البيئة غير صالحة:\n${details}`);
  }
  return parsed.data;
}
