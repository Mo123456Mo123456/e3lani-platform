import { z } from "zod";

export const accountTypes = ["INDIVIDUAL", "STORE", "BRAND", "COMPANY"] as const;
export const staffRoles = [
  "SUPER_ADMIN",
  "ADS_MODERATOR",
  "SUPPORT",
  "CAMPAIGN_MANAGER",
  "FINANCE_MANAGER",
  "CONTENT_MANAGER"
] as const;
export const mediaKinds = ["IMAGE", "VIDEO"] as const;
export const contactTypes = ["STORE", "PRODUCT", "WHATSAPP", "PHONE", "EXTERNAL"] as const;
export const adStatuses = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "ACTIVE",
  "PAUSED",
  "EXPIRED",
  "REMOVED"
] as const;
export const bannerStatuses = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "AWAITING_REVIEW",
  "APPROVED",
  "ACTIVE",
  "REJECTED",
  "EXPIRED",
  "PAUSED"
] as const;

export type AccountType = (typeof accountTypes)[number];
export type StaffRole = (typeof staffRoles)[number];
export type MediaKind = (typeof mediaKinds)[number];
export type ContactType = (typeof contactTypes)[number];
export type AdStatus = (typeof adStatuses)[number];
export type BannerStatus = (typeof bannerStatuses)[number];

const saudiPhone = /^\+9665\d{8}$/;
const safeHttpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", "HTTPS is required");

export const requestOtpSchema = z.object({
  phone: z.string().regex(saudiPhone, "Use +9665XXXXXXXX")
});

export const verifyOtpSchema = requestOtpSchema.extend({
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(2).max(80).optional(),
  cityId: z.string().uuid().optional(),
  accountType: z.enum(accountTypes).optional(),
  email: z.string().email().optional(),
  acceptedTerms: z.literal(true).optional()
});

export const completeProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    cityId: z.string().uuid(),
    accountType: z.enum(accountTypes),
    email: z.string().email().nullable().optional(),
    acceptedTerms: z.literal(true)
  })
  .superRefine((value, context) => {
    if (value.accountType !== "INDIVIDUAL" && !value.email) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Email is required for commercial accounts"
      });
    }
  });

export const contactSchema = z.discriminatedUnion("type", [
  z.object({ type: z.enum(["STORE", "PRODUCT", "EXTERNAL"]), value: safeHttpsUrl }),
  z.object({ type: z.literal("WHATSAPP"), value: z.string().regex(saudiPhone) }),
  z.object({ type: z.literal("PHONE"), value: z.string().regex(saudiPhone) })
]);

export const mediaInputSchema = z.object({
  assetId: z.string().uuid(),
  order: z.number().int().min(0).max(4)
});

export const createAdSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid(),
  cityId: z.string().uuid(),
  scope: z.enum(["CITY", "KINGDOM"]),
  price: z.number().nonnegative().max(100_000_000).optional(),
  media: z.array(mediaInputSchema).min(1).max(5),
  contact: contactSchema
});

export const createPostSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(2000).optional(),
  media: z.array(mediaInputSchema).min(1).max(5)
});

export const feedQuerySchema = z.object({
  mode: z.enum(["FOR_YOU", "NEARBY", "LATEST"]).default("FOR_YOU"),
  cityId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  media: z.enum(mediaKinds).optional(),
  verified: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  sponsored: z.coerce.boolean().optional(),
  sort: z.enum(["LATEST", "MOST_VIEWED"]).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10)
});

export const reportSchema = z.object({
  reason: z.enum([
    "PROHIBITED_CONTENT",
    "FRAUD",
    "MISLEADING",
    "WRONG_CATEGORY",
    "DUPLICATE",
    "OTHER"
  ]),
  details: z.string().trim().max(500).optional()
});

export const analyticsEventSchema = z.object({
  adId: z.string().uuid(),
  type: z.enum([
    "IMPRESSION",
    "VIDEO_VIEW",
    "VIDEO_COMPLETE",
    "CONTACT_STORE",
    "CONTACT_WHATSAPP",
    "CONTACT_PHONE",
    "SAVE",
    "SHARE"
  ]),
  watchMs: z.number().int().nonnegative().max(60_000).optional(),
  cityId: z.string().uuid().optional(),
  source: z.enum(["ORGANIC", "PAID"]).default("ORGANIC"),
  idempotencyKey: z.string().min(16).max(128)
});

export const prepareUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]),
  size: z.number().int().positive().max(100 * 1024 * 1024)
});

export const pricingCodes = [
  "AD_30_DAYS",
  "REPUBLISH",
  "EXTEND_15_DAYS",
  "FEATURE_3_DAYS",
  "FEATURE_7_DAYS",
  "TOP_CATEGORY",
  "EXTRA_CITY",
  "TOP_STRIP_LOGO"
] as const;

export const updatePriceSchema = z.object({
  amountHalalas: z.number().int().nonnegative(),
  active: z.boolean()
});

export interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}
