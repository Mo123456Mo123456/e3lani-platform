import { z } from 'zod';
import { MEDIA_LIMITS, normalizeMediaMime } from '@e3lani/config';

export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format');

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  locale: z.enum(['ar', 'en']).default('ar'),
  countryCode: z.string().length(2).default('SA'),
  acceptedTerms: z.literal(true),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{4,8}$/),
  deviceId: z.string().min(8).max(128).optional(),
});

export const contactMethodsSchema = z
  .object({
    storeUrl: z.string().url().optional(),
    whatsapp: phoneSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((v) => Boolean(v.storeUrl || v.whatsapp || v.phone), {
    message: 'At least one contact method is required',
  });

export const createAdDraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid().optional(),
  countryCode: z.string().length(2),
  cityId: z.string().uuid(),
  contactMethods: contactMethodsSchema,
});

export const mediaUploadIntentSchema = z.object({
  kind: z.enum(['image', 'video']),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().positive().optional(),
  /** Ignored — clients must not control storage keys/filenames. */
  fileName: z.string().max(255).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).optional(),
  allDevices: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().optional(),
  locale: z.enum(['ar', 'en']).optional(),
  cityId: z.string().uuid().optional(),
  avatarUrl: z.string().url().optional(),
});

export const reportAdSchema = z.object({
  reason: z.enum(['spam', 'fraud', 'inappropriate', 'misleading', 'other']),
  details: z.string().trim().max(2000).optional(),
});

export const createAppealSchema = z.object({
  adId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
  reason: z.string().trim().min(5),
  details: z.string().trim().max(2000).optional(),
});

const analyticsPayloadSchema = z
  .record(z.unknown())
  .or(z.array(z.unknown()))
  .or(z.string())
  .or(z.number())
  .or(z.boolean())
  .or(z.null());

export const analyticsEventsSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        adId: z.string().uuid().optional(),
        sessionId: z.string().trim().min(1).max(200).optional(),
        platform: z.string().trim().min(1).max(50).optional(),
        locale: z.string().trim().min(1).max(10).optional(),
        payload: analyticsPayloadSchema.optional(),
      }),
    )
    .max(50),
});

const optionalBooleanQuery = z.preprocess((value) => {
  if (value === undefined || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value;
}, z.boolean().optional());

const optionalTakeQuery = z.preprocess((value) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'string') return Number(value);
  return value;
}, z.number().int().min(1).max(50).optional());

export const feedSearchSchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  cityId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  kind: z.enum(['image', 'video']).optional(),
  sort: z.enum(['latest', 'views', 'featured']).optional(),
  verified: optionalBooleanQuery,
  featured: optionalBooleanQuery,
  cursor: z.string().uuid().optional(),
  take: optionalTakeQuery,
});

export const campaignTargetingSchema = z
  .object({
    cityIds: z.array(z.string().uuid()).optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

const campaignDateFields = {
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
};

function validCampaignDateRange(value: {
  startsAt?: string | undefined;
  endsAt?: string | undefined;
}) {
  return !value.startsAt || !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt);
}

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(500),
  budgetTotal: z.number().positive(),
  currency: z.string().trim().length(3).default('SAR'),
  ...campaignDateFields,
  targeting: campaignTargetingSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  adIds: z.array(z.string().uuid()).optional(),
}).refine(validCampaignDateRange, {
  message: 'Campaign endsAt must be after startsAt',
  path: ['endsAt'],
});

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  objective: z.string().trim().min(1).max(500).optional(),
  budgetTotal: z.number().positive().optional(),
  currency: z.string().trim().length(3).optional(),
  ...campaignDateFields,
  targeting: campaignTargetingSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).refine(validCampaignDateRange, {
  message: 'Campaign endsAt must be after startsAt',
  path: ['endsAt'],
});

export const scheduleAdSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const shareAdSchema = z.object({
  channel: z.string().trim().min(1).max(80).optional(),
});

export function validateMediaIntent(input: z.infer<typeof mediaUploadIntentSchema>): {
  kind: 'image' | 'video';
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
} {
  const parsed = mediaUploadIntentSchema.parse(input);
  const mimeType = normalizeMediaMime(parsed.mimeType);

  if (parsed.kind === 'video') {
    if (!(MEDIA_LIMITS.videoMime as readonly string[]).includes(mimeType)) {
      throw new Error('Unsupported video mime type');
    }
    if (parsed.sizeBytes > MEDIA_LIMITS.maxVideoBytes) {
      throw new Error('Video exceeds 200MB limit');
    }
    if (parsed.durationSeconds === undefined) {
      throw new Error('Video durationSeconds is required');
    }
    if (parsed.durationSeconds > MEDIA_LIMITS.maxVideoSeconds) {
      throw new Error('Video exceeds 60 seconds');
    }
    return {
      kind: 'video',
      mimeType,
      sizeBytes: parsed.sizeBytes,
      durationSeconds: parsed.durationSeconds,
    };
  }

  if (!(MEDIA_LIMITS.imageMime as readonly string[]).includes(mimeType)) {
    throw new Error('Unsupported image mime type');
  }
  if (parsed.sizeBytes > MEDIA_LIMITS.maxImageBytes) {
    throw new Error('Image exceeds 20MB limit');
  }
  return {
    kind: 'image',
    mimeType,
    sizeBytes: parsed.sizeBytes,
  };
}

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CreateAdDraftInput = z.infer<typeof createAdDraftSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ReportAdInput = z.infer<typeof reportAdSchema>;
export type CreateAppealInput = z.infer<typeof createAppealSchema>;
export type AnalyticsEventsInput = z.infer<typeof analyticsEventsSchema>;
export type FeedSearchInput = z.infer<typeof feedSearchSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ScheduleAdInput = z.infer<typeof scheduleAdSchema>;
export type ShareAdInput = z.infer<typeof shareAdSchema>;
