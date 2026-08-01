import { COOKIE_NAME } from "../shared/const.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { completeMediaUpload, prepareMediaUpload } from "./media-service";
import { normalizeLaunchPolicy } from "../lib/launch-policy";

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

function sessionUser(user: NonNullable<Awaited<ReturnType<typeof sdk.authenticateRequest>>> | null) {
  if (!user) return null;
  return {
    id: user.id,
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
    accountType: user.accountType,
    status: user.status,
    preferredLanguage: user.preferredLanguage,
    cityId: user.cityId,
    lastSignedIn: user.lastSignedIn,
  };
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
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
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await sdk.revokeRequestSession(ctx.req);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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
  product: router({
    config: publicProcedure.query(() => db.getPublicProductConfig()),
    catalog: publicProcedure.query(() => db.getPublicCatalog()),
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
        // Validate known keys against the canonical policy shape.
        normalizeLaunchPolicy({ ...patch });
        return db.updateLaunchPolicy(patch, ctx.user.id);
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
