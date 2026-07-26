import { z } from 'zod';
import { MEDIA_LIMITS } from '@e3lani/config';

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
});

export function validateMediaIntent(input: z.infer<typeof mediaUploadIntentSchema>): void {
  const parsed = mediaUploadIntentSchema.parse(input);
  if (parsed.kind === 'video') {
    if (!(MEDIA_LIMITS.videoMime as readonly string[]).includes(parsed.mimeType)) {
      throw new Error('Unsupported video mime type');
    }
    if (parsed.sizeBytes > MEDIA_LIMITS.maxVideoBytes) {
      throw new Error('Video exceeds 200MB limit');
    }
    if (parsed.durationSeconds && parsed.durationSeconds > MEDIA_LIMITS.maxVideoSeconds) {
      throw new Error('Video exceeds 60 seconds');
    }
  } else {
    if (!(MEDIA_LIMITS.imageMime as readonly string[]).includes(parsed.mimeType)) {
      throw new Error('Unsupported image mime type');
    }
  }
}

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CreateAdDraftInput = z.infer<typeof createAdDraftSchema>;
