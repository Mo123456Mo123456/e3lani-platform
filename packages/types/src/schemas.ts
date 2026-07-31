import { z } from 'zod';
import {
  AD_LIMITS, ALLOWED_LINK_HOSTS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, POST_LIMITS,
  REPORT_REASONS, normalizeSaudiPhone,
} from '@e3lani/config';
import {
  ACCOUNT_TYPES, AD_EVENT_TYPES, AD_STATUSES, CONTACT_METHODS, MEDIA_TYPES,
  PROMOTION_TYPES, REACH_SCOPES, SORT_OPTIONS,
} from './enums';

/* -------------------------------------------------------------------------- */
/* عناصر أساسية                                                                */
/* -------------------------------------------------------------------------- */

export const cuidSchema = z.string().min(10).max(40);

export const saudiPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeSaudiPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'رقم جوال سعودي غير صالح' });
      return z.NEVER;
    }
    return normalized;
  });

export const localeSchema = z.enum(['ar', 'en']).default('ar');

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const externalUrlSchema = z
  .string()
  .trim()
  .url('رابط غير صالح')
  .refine((value) => value.startsWith('https://'), 'يجب أن يبدأ الرابط بـ https')
  .refine((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
      return ALLOWED_LINK_HOSTS.some((allowed) => {
        const normalized = allowed.replace(/^www\./, '');
        return host === normalized || host.endsWith(`.${normalized}`);
      });
    } catch {
      return false;
    }
  }, 'النطاق غير معتمد');

/* -------------------------------------------------------------------------- */
/* المصادقة                                                                    */
/* -------------------------------------------------------------------------- */

export const requestOtpSchema = z.object({
  phone: saudiPhoneSchema,
  purpose: z.enum(['LOGIN', 'REGISTER', 'PHONE_CHANGE']).default('LOGIN'),
});

export const verifyOtpSchema = z.object({
  phone: saudiPhoneSchema,
  code: z.string().trim().regex(/^\d{4,6}$/, 'رمز التحقق غير صالح'),
  deviceId: z.string().max(120).optional(),
});

export const completeProfileSchema = z.object({
  name: z.string().trim().min(2, 'الاسم قصير جدًا').max(60),
  cityId: cuidSchema,
  accountType: z.enum(ACCOUNT_TYPES),
  email: z.string().trim().email('بريد إلكتروني غير صالح').optional(),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'يجب الموافقة على الشروط' }) }),
  acceptedPrivacy: z.literal(true, { errorMap: () => ({ message: 'يجب الموافقة على سياسة الخصوصية' }) }),
}).superRefine((value, ctx) => {
  const isBusiness = value.accountType !== 'INDIVIDUAL';
  if (isBusiness && !value.email) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['email'],
      message: 'البريد الإلكتروني مطلوب للحسابات التجارية',
    });
  }
});

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(20) });

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

/* -------------------------------------------------------------------------- */
/* الملف الشخصي                                                                */
/* -------------------------------------------------------------------------- */

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  cityId: cuidSchema.optional(),
  email: z.string().trim().email().nullable().optional(),
  avatarMediaId: cuidSchema.nullable().optional(),
  locale: z.enum(['ar', 'en']).optional(),
});

export const updateBusinessProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  logoMediaId: cuidSchema.nullable().optional(),
  coverMediaId: cuidSchema.nullable().optional(),
  storeUrl: externalUrlSchema.nullable().optional(),
  websiteUrl: externalUrlSchema.nullable().optional(),
  whatsapp: saudiPhoneSchema.nullable().optional(),
  contactPhone: saudiPhoneSchema.nullable().optional(),
  socials: z
    .object({
      instagram: externalUrlSchema.optional(),
      snapchat: externalUrlSchema.optional(),
      tiktok: externalUrlSchema.optional(),
      x: externalUrlSchema.optional(),
    })
    .partial()
    .optional(),
});

/* -------------------------------------------------------------------------- */
/* الوسائط                                                                     */
/* -------------------------------------------------------------------------- */

export const createUploadSchema = z.object({
  type: z.enum(MEDIA_TYPES),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive(),
  fileName: z.string().max(200).optional(),
  purpose: z.enum(['AD', 'POST', 'AVATAR', 'LOGO', 'COVER', 'TICKER_LOGO']).default('AD'),
});

export const completeUploadSchema = z.object({
  mediaId: cuidSchema,
  durationMs: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/* -------------------------------------------------------------------------- */
/* الإعلانات                                                                   */
/* -------------------------------------------------------------------------- */

const contactValueSchemas = {
  WHATSAPP: saudiPhoneSchema,
  PHONE: saudiPhoneSchema,
  STORE_LINK: externalUrlSchema,
  PRODUCT_LINK: externalUrlSchema,
  EXTERNAL_LINK: externalUrlSchema,
} as const;

export const adContactSchema = z
  .object({
    contactMethod: z.enum(CONTACT_METHODS),
    contactValue: z.string().trim().min(3).max(300),
  })
  .superRefine((value, ctx) => {
    const result = contactValueSchemas[value.contactMethod].safeParse(value.contactValue);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactValue'],
        message: result.error.issues[0]?.message ?? 'قيمة تواصل غير صالحة',
      });
    }
  });

export const createAdSchema = z
  .object({
    title: z.string().trim().min(AD_LIMITS.titleMin).max(AD_LIMITS.titleMax),
    description: z.string().trim().max(AD_LIMITS.descriptionMax).optional(),
    categoryId: cuidSchema,
    subcategoryId: cuidSchema.optional(),
    cityId: cuidSchema,
    reachScope: z.enum(REACH_SCOPES).default('CITY'),
    extraCityIds: z.array(cuidSchema).max(AD_LIMITS.maxExtraCities).default([]),
    /** السعر اختياري تمامًا */
    price: z.number().nonnegative().max(100_000_000).nullable().optional(),
    contactMethod: z.enum(CONTACT_METHODS),
    contactValue: z.string().trim().min(3).max(300),
    mediaIds: z.array(cuidSchema).min(1, 'أضف صورة أو فيديو').max(5),
  })
  .superRefine((value, ctx) => {
    const result = contactValueSchemas[value.contactMethod].safeParse(value.contactValue);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactValue'],
        message: result.error.issues[0]?.message ?? 'قيمة تواصل غير صالحة',
      });
    }
  });

export const updateAdSchema = z.object({
  title: z.string().trim().min(AD_LIMITS.titleMin).max(AD_LIMITS.titleMax).optional(),
  description: z.string().trim().max(AD_LIMITS.descriptionMax).nullable().optional(),
  categoryId: cuidSchema.optional(),
  subcategoryId: cuidSchema.nullable().optional(),
  cityId: cuidSchema.optional(),
  reachScope: z.enum(REACH_SCOPES).optional(),
  price: z.number().nonnegative().nullable().optional(),
  contactMethod: z.enum(CONTACT_METHODS).optional(),
  contactValue: z.string().trim().min(3).max(300).optional(),
  mediaIds: z.array(cuidSchema).min(1).max(5).optional(),
});

export const feedQuerySchema = paginationSchema.extend({
  tab: z.enum(['for-you', 'nearby', 'latest']).default('for-you'),
  cityId: cuidSchema.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  categoryId: cuidSchema.optional(),
});

export const searchQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  cityId: cuidSchema.optional(),
  categoryId: cuidSchema.optional(),
  subcategoryId: cuidSchema.optional(),
  nearMe: z.coerce.boolean().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(1).max(500).optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  highlightedOnly: z.coerce.boolean().optional(),
  promotedOnly: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(SORT_OPTIONS).default('latest'),
});

/* -------------------------------------------------------------------------- */
/* المنشورات المجانية (منفصلة تمامًا عن الإعلانات)                              */
/* -------------------------------------------------------------------------- */

export const createPostSchema = z.object({
  caption: z.string().trim().min(1).max(POST_LIMITS.captionMax),
  mediaIds: z.array(cuidSchema).min(1).max(POST_LIMITS.maxImages),
});

export const updatePostSchema = z.object({
  caption: z.string().trim().min(1).max(POST_LIMITS.captionMax).optional(),
  mediaIds: z.array(cuidSchema).min(1).max(POST_LIMITS.maxImages).optional(),
});

/* -------------------------------------------------------------------------- */
/* البلاغات والاعتراضات                                                        */
/* -------------------------------------------------------------------------- */

export const reportReasonSchema = z.enum(
  REPORT_REASONS.map((reason) => reason.key) as [string, ...string[]],
);

export const createReportSchema = z
  .object({
    adId: cuidSchema.optional(),
    postId: cuidSchema.optional(),
    reason: reportReasonSchema,
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => Boolean(value.adId) !== Boolean(value.postId), {
    message: 'حدّد إعلانًا أو منشورًا واحدًا فقط',
  });

export const createAppealSchema = z.object({
  adId: cuidSchema.optional(),
  postId: cuidSchema.optional(),
  message: z.string().trim().min(10).max(1000),
});

export const resolveReportSchema = z.object({
  action: z.enum(['DISMISS', 'SUSPEND', 'DELETE', 'RESTORE']),
  reason: z.string().trim().min(3).max(500),
  notifyOwner: z.boolean().default(true),
});

/* -------------------------------------------------------------------------- */
/* الترويج والدفع                                                              */
/* -------------------------------------------------------------------------- */

export const purchasePromotionSchema = z.object({
  adId: cuidSchema,
  type: z.enum(PROMOTION_TYPES),
  extraCityIds: z.array(cuidSchema).max(AD_LIMITS.maxExtraCities).optional(),
});

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        pricingKey: z.string().min(2).max(40),
        adId: cuidSchema.optional(),
        tickerRequestId: cuidSchema.optional(),
        quantity: z.number().int().min(1).max(20).default(1),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .min(1),
  returnUrl: z.string().url().optional(),
});

export const upsertPricingSchema = z.object({
  key: z.string().trim().min(2).max(40),
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  descriptionAr: z.string().trim().max(200).optional(),
  amountHalalas: z.number().int().min(0).max(100_000_000),
  durationDays: z.number().int().min(0).max(3650).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/* -------------------------------------------------------------------------- */
/* الشريط الإعلاني العلوي                                                      */
/* -------------------------------------------------------------------------- */

export const createTickerRequestSchema = z.object({
  businessName: z.string().trim().min(2).max(60),
  logoMediaId: cuidSchema,
  requestedDays: z.number().int().min(7).max(365).default(30),
  note: z.string().trim().max(300).optional(),
});

export const reviewTickerRequestSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'STOP']),
  reason: z.string().trim().max(500).optional(),
  startsAt: z.coerce.date().optional(),
  days: z.number().int().min(1).max(365).optional(),
});

/* -------------------------------------------------------------------------- */
/* التحليلات                                                                   */
/* -------------------------------------------------------------------------- */

export const trackEventsSchema = z.object({
  deviceId: z.string().trim().min(6).max(120),
  events: z
    .array(
      z.object({
        adId: cuidSchema,
        type: z.enum(AD_EVENT_TYPES),
        occurredAt: z.coerce.date().optional(),
        watchedMs: z.number().int().nonnegative().max(3_600_000).optional(),
        completed: z.boolean().optional(),
        source: z.enum(['ORGANIC', 'PROMOTED']).default('ORGANIC'),
        cityId: cuidSchema.optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const analyticsRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/* -------------------------------------------------------------------------- */
/* الأقسام والمدن ولوحة الإدارة                                                */
/* -------------------------------------------------------------------------- */

export const upsertCategorySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'المعرّف يجب أن يكون حروفًا لاتينية صغيرة'),
  nameAr: z.string().trim().min(2).max(60),
  nameEn: z.string().trim().min(2).max(60),
  icon: z.string().trim().max(40).optional(),
  parentId: cuidSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const upsertCitySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/),
  nameAr: z.string().trim().min(2).max(60),
  nameEn: z.string().trim().min(2).max(60),
  regionId: cuidSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const adminListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const adminModerateAdSchema = z.object({
  action: z.enum(['SUSPEND', 'RESTORE', 'DELETE', 'REJECT']),
  reason: z.string().trim().min(3).max(500),
  notifyOwner: z.boolean().default(true),
});

export const createAdminUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(60),
  password: z
    .string()
    .min(10, 'كلمة المرور قصيرة')
    .max(128)
    .regex(/[A-Z]/, 'يجب أن تحتوي حرفًا كبيرًا')
    .regex(/[a-z]/, 'يجب أن تحتوي حرفًا صغيرًا')
    .regex(/\d/, 'يجب أن تحتوي رقمًا'),
  role: z.enum([
    'SUPER_ADMIN', 'ADS_MODERATOR', 'SUPPORT', 'CAMPAIGN_MANAGER', 'FINANCE_MANAGER', 'CONTENT_MANAGER',
  ]),
});

export const updateSettingSchema = z.object({
  key: z.string().trim().min(2).max(60),
  value: z.any(),
});

export const sendNotificationSchema = z.object({
  userIds: z.array(cuidSchema).min(1).max(500).optional(),
  audience: z.enum(['ALL', 'BUSINESS', 'INDIVIDUAL']).optional(),
  titleAr: z.string().trim().min(2).max(120),
  titleEn: z.string().trim().min(2).max(120),
  bodyAr: z.string().trim().min(2).max(400),
  bodyEn: z.string().trim().min(2).max(400),
  data: z.record(z.string(), z.any()).optional(),
});

export const adStatusFilterSchema = z.enum(AD_STATUSES);
