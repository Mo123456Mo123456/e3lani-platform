import { z } from "zod";

export const accountTypes = ["INDIVIDUAL", "STORE", "BRAND", "COMPANY"] as const;
export const staffRoles = [
  "USER",
  "SUPER_ADMIN",
  "ADS_MODERATOR",
  "SUPPORT",
  "CAMPAIGN_MANAGER",
  "FINANCE_MANAGER",
  "CONTENT_MANAGER",
] as const;
export const adStatuses = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "ACTIVE",
  "PAUSED",
  "SUSPENDED",
  "EXPIRED",
  "DELETED",
] as const;
export const bannerStatuses = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "AWAITING_REVIEW",
  "APPROVED",
  "ACTIVE",
  "REJECTED",
  "EXPIRED",
  "PAUSED",
] as const;
export const contactTypes = ["STORE", "PRODUCT", "WHATSAPP", "PHONE", "EXTERNAL"] as const;
export const mediaKinds = ["IMAGE", "VIDEO"] as const;
export const audienceScopes = ["CITY", "NATIONWIDE"] as const;
export const reportReasons = [
  "PROHIBITED",
  "MISLEADING",
  "DUPLICATE",
  "WRONG_CATEGORY",
  "BROKEN_LINK",
  "INAPPROPRIATE",
  "OTHER",
] as const;

export type AccountType = (typeof accountTypes)[number];
export type StaffRole = (typeof staffRoles)[number];
export type AdStatus = (typeof adStatuses)[number];
export type BannerStatus = (typeof bannerStatuses)[number];
export type MediaKind = (typeof mediaKinds)[number];

const saudiPhone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^(?:\+966|00966|966|0)?5\d{8}$/))
  .transform((value) => `+966${value.replace(/^(?:\+966|00966|966|0)/, "")}`);

export const requestOtpSchema = z.object({
  phone: saudiPhone,
});

export const verifyOtpSchema = z.object({
  phone: saudiPhone,
  code: z.string().regex(/^\d{4,8}$/),
  deviceName: z.string().trim().min(1).max(120).optional(),
});

export const completeProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    cityId: z.string().uuid(),
    accountType: z.enum(accountTypes),
    email: z.string().email().max(254).nullish(),
    acceptedTerms: z.literal(true),
    acceptedPrivacy: z.literal(true),
  })
  .superRefine((value, context) => {
    if (value.accountType !== "INDIVIDUAL" && !value.email) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "BUSINESS_EMAIL_REQUIRED",
      });
    }
  });

export const contactSchema = z.object({
  type: z.enum(contactTypes),
  value: z.string().trim().min(3).max(500),
  label: z.string().trim().max(80).optional(),
});

export const createAdSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(4000).optional(),
    categoryId: z.string().uuid(),
    subcategoryId: z.string().uuid(),
    cityId: z.string().uuid().optional(),
    audienceScope: z.enum(audienceScopes),
    mediaIds: z.array(z.string().uuid()).min(1).max(5),
    contacts: z.array(contactSchema).min(1).max(5),
  })
  .superRefine((value, context) => {
    if (value.audienceScope === "CITY" && !value.cityId) {
      context.addIssue({ code: "custom", path: ["cityId"], message: "CITY_REQUIRED" });
    }
  });

export const updateAdSchema = createAdSchema.partial();

export const createPostSchema = z.object({
  caption: z.string().trim().max(2200).optional(),
  mediaIds: z.array(z.string().uuid()).min(1).max(5),
});

export const feedQuerySchema = z.object({
  mode: z.enum(["FOR_YOU", "NEARBY", "LATEST"]).default("FOR_YOU"),
  cityId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  mediaKind: z.enum(mediaKinds).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  featuredOnly: z.coerce.boolean().optional(),
  sponsoredOnly: z.coerce.boolean().optional(),
  sort: z.enum(["LATEST", "MOST_VIEWED"]).default("LATEST"),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export const createReportSchema = z.object({
  reason: z.enum(reportReasons),
  details: z.string().trim().max(1000).optional(),
});

export const moderationDecisionSchema = z.object({
  action: z.enum(["SUSPEND", "DELETE", "REACTIVATE", "DISMISS"]),
  reason: z.string().trim().min(3).max(1000),
  notifyOwner: z.boolean().default(true),
});

export const createAppealSchema = z.object({
  message: z.string().trim().min(10).max(2000),
});

export const updatePriceSchema = z.object({
  priceHalalas: z.number().int().min(0).max(10_000_000),
  durationDays: z.number().int().positive().max(365).optional(),
  enabled: z.boolean(),
});

export const analyticsEventSchema = z.object({
  adId: z.string().uuid(),
  event: z.enum([
    "IMPRESSION",
    "UNIQUE_REACH",
    "VIDEO_VIEW",
    "VIDEO_COMPLETE",
    "WHATSAPP_CLICK",
    "STORE_CLICK",
    "PHONE_CLICK",
    "SAVE",
    "SHARE",
  ]),
  watchDurationMs: z.number().int().nonnegative().max(60_000).optional(),
  cityId: z.string().uuid().optional(),
  source: z.enum(["ORGANIC", "PAID"]).default("ORGANIC"),
  dedupeKey: z.string().max(180).optional(),
});

export const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]),
  bytes: z.number().int().positive().max(100 * 1024 * 1024),
});

export const mediaHardLimits = {
  maxImages: 5,
  maxVideoDurationSeconds: 60,
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
} as const;

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const priceCodes = [
  "STANDARD_AD",
  "REPUBLISH",
  "EXTEND_15_DAYS",
  "HIGHLIGHT_3_DAYS",
  "HIGHLIGHT_7_DAYS",
  "TOP_CATEGORY",
  "EXTRA_CITY",
  "TOP_STRIP_LOGO",
] as const;

export type PriceCode = (typeof priceCodes)[number];
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type CreateAdInput = z.infer<typeof createAdSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
