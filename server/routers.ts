import { COOKIE_NAME, SESSION_TTL_MS } from "../shared/const.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { completeMediaUpload, prepareMediaUpload } from "./media-service";
import { normalizeLaunchPolicy } from "../lib/launch-policy";
import * as adsService from "./ads-service";
import { listAuditLogs } from "./audit-service";
import {
  deactivateCoupon,
  listCoupons,
  listExemptions,
  upsertCoupon,
  upsertExemption,
} from "./coupons-service";
import { listCitiesForCountry, listCountriesPage, setCountryActive } from "./countries-service";
import { decideModerationCase, listModerationQueue } from "./moderation-service";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications-service";
import {
  deactivatePricingRule,
  listActiveScopedRules,
  resolveServerPublishQuote,
} from "./pricing-service";
import { requestOtp, verifyOtp } from "./otp/service";
import { createPaymentIntentForAd, handlePaymentWebhook } from "./payments/service";
import { mergeVisitorIntoUser, upsertVisitorSession } from "./visitor-service";
import { writeAuditLog } from "./audit-service";
import { eq } from "drizzle-orm";
import { countries, scopedPricingRules } from "../drizzle/schema";
import { randomBytes } from "crypto";

const mediaMetadataInput = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
  bytes: z.number().int().positive().max(50 * 1024 * 1024),
  width: z.number().int().positive().max(20_000).nullable().optional(),
  height: z.number().int().positive().max(20_000).nullable().optional(),
  durationMs: z.number().int().nonnegative().max(30 * 60 * 1000).nullable().optional(),
});

function mediaError(error: unknown): never {
  const message = error instanceof Error ? error.message : "MEDIA_OPERATION_FAILED";
  if (message.endsWith("_NOT_FOUND")) {
    throw new TRPCError({ code: "NOT_FOUND", message });
  }
  if (message === "MEDIA_ASSET_IN_USE") {
    throw new TRPCError({ code: "CONFLICT", message });
  }
  if (
    message.startsWith("MEDIA_") &&
    !message.includes("DATABASE") &&
    !message.includes("SIGNING")
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "MEDIA_OPERATION_FAILED", cause: error });
}

function mapServiceError(error: unknown): never {
  const message = error instanceof Error ? error.message : "OPERATION_FAILED";
  if (
    message.endsWith("_NOT_FOUND") ||
    message === "CATEGORY_NOT_FOUND" ||
    message === "CITY_NOT_FOUND" ||
    message === "AD_NOT_FOUND" ||
    message === "MODERATION_CASE_NOT_FOUND" ||
    message === "PAYMENT_INTENT_NOT_FOUND"
  ) {
    throw new TRPCError({ code: "NOT_FOUND", message });
  }
  if (
    message === "AD_FORBIDDEN" ||
    message === "SANDBOX_PAYMENT_FORBIDDEN_IN_PRODUCTION"
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
  if (
    message.startsWith("OTP_") ||
    message.startsWith("PAYMENT_") ||
    message.startsWith("MEDIA_") ||
    message.includes("NOT_READY") ||
    message.includes("FORBIDDEN") ||
    message === "AD_NOT_PAUSED" ||
    message === "AD_NOT_PAUSABLE" ||
    message === "AD_NOT_PUBLISHABLE" ||
    message === "AD_AWAITING_PAYMENT" ||
    message === "AD_MODERATION_REJECTED" ||
    message === "PAYMENTS_DISABLED" ||
    message === "ZERO_AMOUNT_PAYMENT_FORBIDDEN" ||
    message.startsWith("PAYMENT_PROVIDER") ||
    message.startsWith("COUPON_") ||
    message.startsWith("AD_")
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
}

function sessionUser(user: NonNullable<Awaited<ReturnType<typeof sdk.authenticateRequest>>> | null) {
  if (!user) return null;
  return {
    id: user.id,
    openId: user.openId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    loginMethod: user.loginMethod,
    role: user.role,
    accountType: user.accountType,
    status: user.status,
    preferredLanguage: user.preferredLanguage,
    cityId: user.cityId,
    countryCode: (user as { countryCode?: string | null }).countryCode ?? null,
    lastSignedIn: user.lastSignedIn,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => sessionUser(opts.ctx.user)),
    sessions: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.listActiveAuthSessions(ctx.user.id);
      return rows.map((session) => ({
        id: session.id,
        clientType: session.clientType,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        current: session.tokenId === ctx.user.sessionTokenId,
      }));
    }),
    requestOtp: publicProcedure
      .input(
        z.object({
          phone: z.string().trim().min(8).max(32),
          purpose: z.enum(["login", "register_advertiser"]).default("login"),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await requestOtp(input);
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    verifyOtp: publicProcedure
      .input(
        z.object({
          phone: z.string().trim().min(8).max(32),
          code: z.string().trim().min(4).max(10),
          purpose: z.enum(["login", "register_advertiser"]).default("login"),
          countryCode: z.string().trim().length(2).optional(),
          clientType: z.enum(["web", "native"]).default("web"),
          anonymousId: z.string().trim().max(128).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { user } = await verifyOtp(input);
          const merged = await mergeVisitorIntoUser({
            anonymousId: input.anonymousId,
            userId: user.id,
          }).catch(() => ({ merged: false as const, favoritesAdded: 0 }));
          const session = await sdk.createManagedSession(user, ctx.req, input.clientType, {
            expiresInMs: SESSION_TTL_MS,
          });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, session.token, {
            ...cookieOptions,
            maxAge: SESSION_TTL_MS,
          });
          return {
            success: true as const,
            token: session.token,
            user: sessionUser({ ...user, sessionTokenId: session.tokenId } as never),
            visitorMerged: merged,
          };
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await sdk.revokeRequestSession(ctx.req);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    logoutOtherDevices: protectedProcedure.mutation(async ({ ctx }) => {
      await db.revokeAllAuthSessions(ctx.user.id, ctx.user.sessionTokenId);
      return { success: true } as const;
    }),
    logoutAllDevices: protectedProcedure.mutation(async ({ ctx }) => {
      await db.revokeAllAuthSessions(ctx.user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  countries: router({
    list: publicProcedure
      .input(
        z
          .object({
            offset: z.number().int().min(0).optional(),
            limit: z.number().int().min(1).max(100).optional(),
            q: z.string().trim().max(80).optional(),
            includeInactive: z.boolean().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        try {
          if (input?.offset != null || input?.limit != null || input?.q || input?.includeInactive) {
            const page = await listCountriesPage(input);
            return page.items;
          }
          return await adsService.listCountries();
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    page: publicProcedure
      .input(
        z
          .object({
            offset: z.number().int().min(0).default(0),
            limit: z.number().int().min(1).max(100).default(40),
            q: z.string().trim().max(80).optional(),
            includeInactive: z.boolean().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        try {
          return await listCountriesPage(input);
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    cities: publicProcedure
      .input(z.object({ countryCode: z.string().trim().length(2) }))
      .query(async ({ input }) => {
        try {
          return await listCitiesForCountry({ countryCode: input.countryCode, includeOther: true });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    setActive: adminProcedure
      .input(z.object({ code: z.string().trim().length(2), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await setCountryActive({
            actorId: ctx.user.id,
            code: input.code,
            isActive: input.isActive,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
  }),
  visitor: router({
    upsert: publicProcedure
      .input(
        z.object({
          anonymousId: z.string().trim().min(8).max(128),
          prefs: z.object({
            accountCountry: z.string().trim().max(8).optional(),
            marketCode: z.string().trim().max(8).optional(),
            forceCountryFilter: z.boolean().optional(),
            categoryFilter: z.string().trim().max(120).optional(),
            countryGateCompleted: z.boolean().optional(),
          }),
          savedAdPublicIds: z.array(z.string().trim().min(2).max(32)).max(200).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await upsertVisitorSession(input);
        } catch (error) {
          return mapServiceError(error);
        }
      }),
  }),
  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(async ({ ctx, input }) => {
        try {
          const rows = await listNotifications(ctx.user.id, input?.limit);
          return rows.map((row) => ({
            id: String(row.id),
            type: row.type,
            titleAr: row.titleAr,
            titleEn: row.titleEn,
            bodyAr: row.bodyAr,
            bodyEn: row.bodyEn,
            entityType: row.entityType,
            entityId: row.entityId,
            read: Boolean(row.readAt),
            createdAt: row.createdAt.toISOString(),
          }));
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await markNotificationRead(ctx.user.id, input.id);
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return await markAllNotificationsRead(ctx.user.id);
      } catch (error) {
        return mapServiceError(error);
      }
    }),
  }),
  moderation: router({
    queue: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
      .query(async ({ input }) => {
        try {
          return await listModerationQueue(input?.limit);
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    decide: adminProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          decision: z.enum(["approve", "reject", "request_changes"]),
          reason: z.string().trim().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await decideModerationCase({
            actorId: ctx.user.id,
            caseId: input.caseId,
            decision: input.decision,
            reason: input.reason,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
  }),
  admin: router({
    audit: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional())
      .query(async ({ input }) => {
        try {
          const rows = await listAuditLogs(input?.limit);
          return rows.map((row) => ({
            id: String(row.id),
            action: row.action,
            entityType: row.entityType,
            entityId: row.entityId,
            actorId: row.actorId,
            actorRole: row.actorRole,
            reason: row.reason,
            createdAt: row.createdAt.toISOString(),
          }));
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    cleanupOrphanMedia: adminProcedure
      .input(
        z
          .object({
            olderThanMinutes: z.number().int().min(5).max(10_080).optional(),
            limit: z.number().int().min(1).max(200).optional(),
          })
          .optional(),
      )
      .mutation(async ({ input }) => {
        try {
          return await adsService.cleanupOrphanMediaAssets(input);
        } catch (error) {
          return mapServiceError(error);
        }
      }),
  }),
  product: router({
    config: publicProcedure.query(() => db.getPublicProductConfig()),
    catalog: publicProcedure.query(() => db.getPublicCatalog()),
    quote: publicProcedure
      .input(
        z.object({
          countryCode: z.string().trim().length(2).optional(),
          categorySlug: z.string().trim().min(1).max(120).optional(),
          accountType: z.string().trim().max(32).optional(),
          couponCode: z.string().trim().max(64).optional(),
          adType: z.string().trim().max(32).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        try {
          const result = await resolveServerPublishQuote({
            ...input,
            userId: ctx.user?.id,
          });
          return {
            quote: result.quote,
            paymentUiVisible: result.paymentUiVisible,
            paymentProviderReady: result.paymentProviderReady,
            blockPublishReason: result.blockPublishReason,
            pricingMode: result.policy.pricingMode,
            globalFreeMode: result.policy.globalFreeMode,
          };
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    listPricingRules: adminProcedure.query(async () => {
      try {
        return await listActiveScopedRules();
      } catch (error) {
        return mapServiceError(error);
      }
    }),
    upsertPricingRule: adminProcedure
      .input(
        z.object({
          publicId: z.string().trim().min(2).max(32).optional(),
          name: z.string().trim().min(2).max(160),
          scopeType: z.enum([
            "global",
            "country",
            "category",
            "account_type",
            "user",
            "brand",
            "campaign",
          ]),
          countryCode: z.string().trim().length(2).nullable().optional(),
          categoryId: z.number().int().positive().nullable().optional(),
          accountType: z.string().trim().max(32).nullable().optional(),
          scopeRef: z.string().trim().max(64).nullable().optional(),
          adType: z.string().trim().max(32).nullable().optional(),
          basePrice: z.number().int().nonnegative(),
          discountPrice: z.number().int().nonnegative().nullable().optional(),
          currency: z.string().trim().length(3).default("SAR"),
          taxRate: z.number().int().nonnegative().default(0),
          startsAt: z.string().datetime().nullable().optional(),
          endsAt: z.string().datetime().nullable().optional(),
          isActive: z.boolean().default(true),
          priority: z.number().int().default(0),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const database = db.requireDatabase(await db.getDb());
          let countryId: number | null = null;
          if (input.countryCode) {
            const rows = await database
              .select({ id: countries.id })
              .from(countries)
              .where(eq(countries.code, input.countryCode.toUpperCase()))
              .limit(1);
            countryId = rows[0]?.id ?? null;
          }
          const publicId = input.publicId ?? `rule_${randomBytes(6).toString("hex")}`;
          const existing = await database
            .select()
            .from(scopedPricingRules)
            .where(eq(scopedPricingRules.publicId, publicId))
            .limit(1);
          const values = {
            name: input.name,
            scopeType: input.scopeType,
            countryId,
            categoryId: input.categoryId ?? null,
            accountType: input.accountType ?? null,
            scopeRef: input.scopeRef ?? null,
            adType: input.adType ?? null,
            basePrice: input.basePrice,
            discountPrice: input.discountPrice ?? null,
            currency: input.currency,
            taxRate: input.taxRate,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            isActive: input.isActive ? 1 : 0,
            priority: input.priority,
            createdBy: ctx.user.id,
          };
          if (existing[0]) {
            await database
              .update(scopedPricingRules)
              .set(values)
              .where(eq(scopedPricingRules.id, existing[0].id));
          } else {
            await database.insert(scopedPricingRules).values({ publicId, ...values });
          }
          await writeAuditLog({
            actorId: ctx.user.id,
            actorRole: "admin",
            action: existing[0] ? "pricing_rule.update" : "pricing_rule.create",
            entityType: "pricing_rule",
            entityId: publicId,
            beforeState: existing[0] ?? null,
            afterState: values,
          }).catch(() => undefined);
          return { ok: true as const, publicId };
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    deactivatePricingRule: adminProcedure
      .input(z.object({ publicId: z.string().trim().min(2).max(32) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await deactivatePricingRule({ actorId: ctx.user.id, publicId: input.publicId });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    listCoupons: adminProcedure.query(async () => {
      try {
        return await listCoupons(true);
      } catch (error) {
        return mapServiceError(error);
      }
    }),
    upsertCoupon: adminProcedure
      .input(
        z.object({
          code: z.string().trim().min(2).max(64),
          name: z.string().trim().max(160).nullable().optional(),
          discountType: z.enum(["percent", "fixed"]),
          discountValue: z.number().int().nonnegative(),
          countryCode: z.string().trim().length(2).nullable().optional(),
          usageLimit: z.number().int().positive().nullable().optional(),
          usageLimitPerUser: z.number().int().positive().nullable().optional(),
          startsAt: z.string().datetime().nullable().optional(),
          expiresAt: z.string().datetime().nullable().optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await upsertCoupon({ actorId: ctx.user.id, ...input });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    deactivateCoupon: adminProcedure
      .input(z.object({ code: z.string().trim().min(2).max(64) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await deactivateCoupon(ctx.user.id, input.code);
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    listExemptions: adminProcedure.query(async () => {
      try {
        return await listExemptions();
      } catch (error) {
        return mapServiceError(error);
      }
    }),
    upsertExemption: adminProcedure
      .input(
        z.object({
          publicId: z.string().trim().min(2).max(32).optional(),
          subjectType: z.enum(["user", "brand"]),
          subjectRef: z.string().trim().min(1).max(64),
          reason: z.string().trim().max(240).nullable().optional(),
          startsAt: z.string().datetime().nullable().optional(),
          endsAt: z.string().datetime().nullable().optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await upsertExemption({ actorId: ctx.user.id, ...input });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    updateLaunchPolicy: adminProcedure
      .input(
        z
          .object({
            globalFreeMode: z.boolean().optional(),
            globalPaidMode: z.boolean().optional(),
            discountMode: z.boolean().optional(),
            countryPricing: z.boolean().optional(),
            categoryPricing: z.boolean().optional(),
            firstAdFree: z.boolean().optional(),
            freeAdsPerUser: z.number().int().nonnegative().nullable().optional(),
            couponSystem: z.boolean().optional(),
            paymentRequired: z.boolean().optional(),
            paymentsEnabled: z.boolean().optional(),
            taxEnabled: z.boolean().optional(),
            featuredAdsEnabled: z.boolean().optional(),
            topBannerEnabled: z.boolean().optional(),
            allCountriesVisibility: z.boolean().optional(),
            instantPublishing: z.boolean().optional(),
            aiModeration: z.boolean().optional(),
            manualPreApproval: z.boolean().optional(),
            postPublishReports: z.boolean().optional(),
            defaultFeedMarket: z.string().min(2).max(8).optional(),
            pricingMode: z.enum(["free", "paid", "discount"]).optional(),
            bannerMessageAr: z.string().max(240).optional(),
            bannerMessageEn: z.string().max(240).optional(),
          })
          .refine((value) => Object.keys(value).length > 0, { message: "EMPTY_PATCH" }),
      )
      .mutation(async ({ ctx, input }) => {
        const patch = Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ) as Record<string, unknown>;
        normalizeLaunchPolicy({ ...patch });
        const result = await db.updateLaunchPolicy(patch, ctx.user.id);
        await writeAuditLog({
          actorId: ctx.user.id,
          actorRole: "admin",
          action: "launch_policy.update",
          entityType: "launch_policy",
          entityId: "launch.policy",
          afterState: patch,
        }).catch(() => undefined);
        return result;
      }),
  }),
  ads: router({
    feed: publicProcedure
      .input(
        z
          .object({
            countryCode: z.string().trim().max(8).nullable().optional(),
            forceCountryFilter: z.boolean().optional(),
            categorySlug: z.string().trim().max(120).nullable().optional(),
            limit: z.number().int().min(1).max(100).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        try {
          return await adsService.listFeedAds({
            countryCode: input?.countryCode,
            forceCountryFilter: input?.forceCountryFilter,
            categorySlug: input?.categorySlug,
            limit: input?.limit,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    get: publicProcedure
      .input(z.object({ id: z.string().trim().min(2).max(32) }))
      .query(async ({ input }) => {
        try {
          const ad = await adsService.getFeedAdByPublicId(input.id);
          if (!ad) throw new Error("AD_NOT_FOUND");
          return ad;
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await adsService.listMineAds(ctx.user.id);
      } catch (error) {
        return mapServiceError(error);
      }
    }),
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().trim().min(4).max(120),
          description: z.string().trim().min(20).max(4000),
          categorySlug: z.string().trim().min(1).max(120),
          cityCode: z.string().trim().min(1).max(64),
          customCityName: z.string().trim().max(120).nullable().optional(),
          countryCode: z.string().trim().length(2),
          mediaAssetIds: z.array(z.number().int().positive()).min(1).max(10),
          contacts: z
            .array(
              z.object({
                type: z.enum(["store", "product", "whatsapp", "phone"]),
                value: z.string().trim().min(3).max(1024),
              }),
            )
            .min(1)
            .max(4),
          couponCode: z.string().trim().max(64).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.createServerAd({
            ownerId: ctx.user.id,
            title: input.title,
            description: input.description,
            categorySlug: input.categorySlug,
            cityCode: input.cityCode,
            customCityName: input.customCityName,
            countryCode: input.countryCode,
            mediaAssetIds: input.mediaAssetIds,
            contacts: input.contacts,
            accountType: ctx.user.accountType,
            couponCode: input.couponCode,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().trim().min(2).max(32),
          title: z.string().trim().min(4).max(120).optional(),
          description: z.string().trim().min(20).max(4000).optional(),
          customCityName: z.string().trim().max(120).nullable().optional(),
          contacts: z
            .array(
              z.object({
                type: z.enum(["store", "product", "whatsapp", "phone"]),
                value: z.string().trim().min(3).max(1024),
              }),
            )
            .min(1)
            .max(4)
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.updateServerAd({
            ownerId: ctx.user.id,
            publicAdId: input.id,
            title: input.title,
            description: input.description,
            customCityName: input.customCityName,
            contacts: input.contacts,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    pause: protectedProcedure
      .input(z.object({ id: z.string().trim().min(2).max(32), reason: z.string().trim().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.pauseServerAd({
            ownerId: ctx.user.id,
            publicAdId: input.id,
            reason: input.reason,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    publish: protectedProcedure
      .input(z.object({ id: z.string().trim().min(2).max(32) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.publishServerAd({
            ownerId: ctx.user.id,
            publicAdId: input.id,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string().trim().min(2).max(32) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.deleteServerAd({
            ownerId: ctx.user.id,
            publicAdId: input.id,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    toggleSave: protectedProcedure
      .input(z.object({ id: z.string().trim().min(2).max(32) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.toggleFavorite(ctx.user.id, input.id);
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    saved: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await adsService.listSavedAds(ctx.user.id);
      } catch (error) {
        return mapServiceError(error);
      }
    }),
    savedIds: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await adsService.listSavedAdIds(ctx.user.id);
      } catch (error) {
        return mapServiceError(error);
      }
    }),
    report: publicProcedure
      .input(
        z.object({
          id: z.string().trim().min(2).max(32),
          reason: z.enum(["spam", "fraud", "prohibited", "misleading", "copyright", "other"]),
          details: z.string().trim().max(2000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.reportAd({
            publicAdId: input.id,
            reporterId: ctx.user?.id ?? null,
            reason: input.reason,
            details: input.details,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    recordEvent: publicProcedure
      .input(
        z.object({
          id: z.string().trim().min(2).max(32),
          eventType: z.enum([
            "impression",
            "view",
            "save",
            "share",
            "store_click",
            "product_click",
            "whatsapp_click",
            "phone_click",
            "report",
          ]),
          dedupeSuffix: z.string().trim().min(1).max(120),
          anonymousId: z.string().trim().max(128).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.recordAdEvent({
            publicAdId: input.id,
            userId: ctx.user?.id ?? null,
            anonymousId: input.anonymousId,
            eventType: input.eventType,
            dedupeSuffix: input.dedupeSuffix,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    appeal: protectedProcedure
      .input(
        z.object({
          id: z.string().trim().min(2).max(32),
          message: z.string().trim().min(10).max(2000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.appealPausedAd({
            userId: ctx.user.id,
            publicAdId: input.id,
            message: input.message,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    adminSetStatus: adminProcedure
      .input(
        z.object({
          id: z.string().trim().min(2).max(32),
          status: z.enum(["active", "paused", "removed"]),
          reason: z.string().trim().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await adsService.adminSetAdStatus({
            actorId: ctx.user.id,
            publicAdId: input.id,
            status: input.status,
            reason: input.reason,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
  }),
  payments: router({
    createIntent: protectedProcedure
      .input(
        z.object({
          adId: z.string().trim().min(2).max(32),
          countryCode: z.string().trim().length(2),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await createPaymentIntentForAd({
            userId: ctx.user.id,
            publicAdId: input.adId,
            countryCode: input.countryCode,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
    webhook: publicProcedure
      .input(
        z.object({
          providerId: z.string().trim().min(2).max(64),
          rawBody: z.string(),
          signature: z.string().nullable(),
          externalId: z.string().trim().min(2).max(255),
          markPaid: z.boolean().default(true),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await handlePaymentWebhook({
            providerId: input.providerId,
            rawBody: input.rawBody,
            signature: input.signature,
            headers: {},
            externalId: input.externalId,
            markPaid: input.markPaid,
          });
        } catch (error) {
          return mapServiceError(error);
        }
      }),
  }),
  media: router({
    policy: publicProcedure.query(() => db.getPublicMediaPolicy()),
    prepareUpload: protectedProcedure.input(mediaMetadataInput).mutation(async ({ ctx, input }) => {
      try {
        return await prepareMediaUpload(ctx.user.id, input);
      } catch (error) {
        return mediaError(error);
      }
    }),
    completeUpload: protectedProcedure
      .input(z.object({ ticket: z.string().min(32).max(4096) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await completeMediaUpload(ctx.user.id, input.ticket);
        } catch (error) {
          return mediaError(error);
        }
      }),
    listMine: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(({ ctx, input }) => db.listOwnedMediaAssets(ctx.user.id, input?.limit ?? 50)),
    attachToRevision: protectedProcedure
      .input(
        z.object({
          revisionId: z.number().int().positive(),
          mediaAssetId: z.number().int().positive(),
          sortOrder: z.number().int().min(0).max(20).optional(),
          altTextAr: z.string().trim().max(240).nullable().optional(),
          altTextEn: z.string().trim().max(240).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.attachMediaAssetToRevision({ ownerId: ctx.user.id, ...input });
        } catch (error) {
          return mediaError(error);
        }
      }),
    listForRevision: protectedProcedure
      .input(z.object({ revisionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        try {
          return await db.listRevisionMediaForOwner(ctx.user.id, input.revisionId);
        } catch (error) {
          return mediaError(error);
        }
      }),
    detach: protectedProcedure
      .input(z.object({ adMediaId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.detachMediaFromRevision(ctx.user.id, input.adMediaId);
        } catch (error) {
          return mediaError(error);
        }
      }),
    delete: protectedProcedure
      .input(z.object({ mediaAssetId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.deleteOwnedMediaAsset(ctx.user.id, input.mediaAssetId);
        } catch (error) {
          return mediaError(error);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
