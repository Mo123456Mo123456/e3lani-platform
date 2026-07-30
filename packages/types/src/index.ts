import { z } from "zod";

export const localeSchema = z.enum(["ar", "en"]);
export const accountTypeSchema = z.enum(["INDIVIDUAL", "STORE", "BRAND", "COMPANY"]);
export const roleSchema = z.enum([
  "USER",
  "ADVERTISER",
  "BRAND_OWNER",
  "MODERATOR",
  "SUPPORT",
  "CAMPAIGN_MANAGER",
  "FINANCE",
  "CONTENT_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
]);
export const launchModeSchema = z.enum(["PROFILE_ONLY", "FREE_LAUNCH", "PAID_ONLY"]);
export const mediaKindSchema = z.enum(["IMAGE", "VIDEO"]);
export const contactTypeSchema = z.enum([
  "STORE_URL",
  "PRODUCT_URL",
  "WHATSAPP",
  "PHONE",
  "EXTERNAL_URL",
]);
export const moderationResultSchema = z.enum(["SAFE", "NEEDS_REVIEW", "BLOCKED"]);
export const distributionStatusSchema = z.enum([
  "DRAFT",
  "PENDING_PAYMENT",
  "ACTIVE",
  "PAUSED",
  "REJECTED",
  "EXPIRED",
  "REMOVED",
]);

const saPhone = /^(?:\+966|00966|966|0)?5\d{8}$/;
const safeUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", "HTTPS_REQUIRED");

export const requestOtpSchema = z.object({
  phone: z.string().regex(saPhone, "INVALID_SAUDI_PHONE"),
});

export const verifyOtpSchema = requestOtpSchema.extend({
  code: z.string().regex(/^\d{4,8}$/),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().regex(saPhone),
    cityId: z.string().cuid(),
    accountType: accountTypeSchema,
    email: z.string().email().optional(),
    acceptedTerms: z.literal(true),
    acceptedPrivacy: z.literal(true),
  })
  .superRefine((data, context) => {
    if (data.accountType !== "INDIVIDUAL" && !data.email) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "BUSINESS_EMAIL_REQUIRED",
      });
    }
  });

export const contactSchema = z
  .object({
    type: contactTypeSchema,
    value: z.string().trim().min(5).max(500),
  })
  .superRefine((data, context) => {
    if (["STORE_URL", "PRODUCT_URL", "EXTERNAL_URL"].includes(data.type)) {
      const parsed = safeUrl.safeParse(data.value);
      if (!parsed.success) {
        context.addIssue({ code: "custom", path: ["value"], message: "INVALID_HTTPS_URL" });
      }
    }
    if (data.type === "PHONE" && !saPhone.test(data.value)) {
      context.addIssue({ code: "custom", path: ["value"], message: "INVALID_SAUDI_PHONE" });
    }
  });

export const createPostSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().cuid(),
  subcategoryId: z.string().cuid().optional(),
  cityId: z.string().cuid(),
  mediaIds: z.array(z.string().cuid()).min(1).max(5),
  contact: contactSchema,
  publish: z.boolean().default(false),
});

export const createDistributionSchema = z.object({
  postId: z.string().cuid(),
  scope: z.enum(["CITY", "NATIONWIDE"]),
  cityIds: z.array(z.string().cuid()).max(20).default([]),
  contact: contactSchema,
  promotionCodes: z.array(z.string().min(2).max(60)).max(10).default([]),
});

export const mediaUploadSchema = z
  .object({
    fileName: z.string().trim().min(1).max(180),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]),
    sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
    kind: mediaKindSchema,
    purpose: z.enum(["POST", "AVATAR", "LOGO", "COVER", "TICKER_LOGO"]),
  })
  .superRefine((data, context) => {
    if (data.kind === "IMAGE" && data.sizeBytes > 10 * 1024 * 1024) {
      context.addIssue({ code: "custom", path: ["sizeBytes"], message: "IMAGE_TOO_LARGE" });
    }
    if (data.kind === "VIDEO" && data.sizeBytes > 100 * 1024 * 1024) {
      context.addIssue({ code: "custom", path: ["sizeBytes"], message: "VIDEO_TOO_LARGE" });
    }
  });

export const feedQuerySchema = z.object({
  mode: z.enum(["FOR_YOU", "NEARBY", "LATEST"]).default("FOR_YOU"),
  cursor: z.string().optional(),
  cityId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  subcategoryId: z.string().cuid().optional(),
  media: z.enum(["IMAGE", "VIDEO"]).optional(),
  verified: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  sponsored: z.coerce.boolean().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export const reportSchema = z.object({
  distributionId: z.string().cuid(),
  reason: z.enum([
    "PROHIBITED_ITEM",
    "FRAUD",
    "MISLEADING",
    "INAPPROPRIATE",
    "DUPLICATE",
    "WRONG_CATEGORY",
    "OTHER",
  ]),
  details: z.string().trim().max(500).optional(),
});

export type AccountType = z.infer<typeof accountTypeSchema>;
export type UserRole = z.infer<typeof roleSchema>;
export type LaunchMode = z.infer<typeof launchModeSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateDistributionInput = z.infer<typeof createDistributionSchema>;

export type FeedMedia = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

export type FeedItem = {
  id: string;
  postId: string;
  title: string;
  description: string | null;
  advertiser: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    verified: boolean;
  };
  city: { id: string; nameAr: string; nameEn: string };
  media: FeedMedia[];
  contact: z.infer<typeof contactSchema>;
  featured: boolean;
  sponsored: boolean;
  viewCount: number;
  saved: boolean;
  createdAt: string;
};
