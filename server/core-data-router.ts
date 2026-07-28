import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createCentralAd,
  createReport,
  getAdByPublicId,
  listFavorites,
  listFeed,
  listMyAds,
  recordEventByPublicId,
  toggleFavorite,
  updateCentralProfile,
} from "./core-data";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const publicAdId = z.string().trim().regex(/^AD[A-F0-9]{14}$/);
const contactInput = z.object({
  type: z.enum(["store", "product", "whatsapp", "phone"]),
  value: z.string().trim().min(1).max(1024),
});

function coreDataError(error: unknown): never {
  const message = error instanceof Error ? error.message : "CORE_DATA_OPERATION_FAILED";
  if (message.endsWith("_NOT_FOUND")) {
    throw new TRPCError({ code: "NOT_FOUND", message });
  }
  if (message === "DATABASE_UNAVAILABLE") {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  }
  if (
    message.endsWith("_INVALID") ||
    message.endsWith("_REQUIRED") ||
    message.endsWith("_EXCEEDED") ||
    message.endsWith("_OWNED") ||
    message.endsWith("_READY") ||
    message.endsWith("_TOO_LONG")
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "CORE_DATA_OPERATION_FAILED",
    cause: error,
  });
}

export const coreDataRouter = router({
  profile: router({
    update: protectedProcedure
      .input(
        z
          .object({
            name: z.string().trim().max(120).optional(),
            phone: z.string().trim().max(32).optional(),
            cityCode: z.string().trim().max(64).optional(),
            displayName: z.string().trim().max(120).optional(),
            bio: z.string().trim().max(1000).optional(),
          })
          .refine((value) => Object.keys(value).length > 0, "PROFILE_PATCH_EMPTY"),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await updateCentralProfile(ctx.user.id, input);
        } catch (error) {
          return coreDataError(error);
        }
      }),
  }),
  ads: router({
    feed: publicProcedure
      .input(
        z
          .object({
            cityCode: z.string().trim().max(64).optional(),
            categoryCode: z.string().trim().max(120).optional(),
            limit: z.number().int().min(1).max(50).default(20),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        try {
          return await listFeed({
            cityCode: input?.cityCode,
            categoryCode: input?.categoryCode,
            limit: input?.limit ?? 20,
          });
        } catch (error) {
          return coreDataError(error);
        }
      }),
    detail: publicProcedure
      .input(z.object({ publicAdId }))
      .query(async ({ ctx, input }) => {
        try {
          return await getAdByPublicId(input.publicAdId, ctx.user?.id);
        } catch (error) {
          return coreDataError(error);
        }
      }),
    mine: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        try {
          return await listMyAds(ctx.user.id, input?.limit ?? 50);
        } catch (error) {
          return coreDataError(error);
        }
      }),
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().trim().min(4).max(120),
          description: z.string().trim().max(4000).optional(),
          categoryCode: z.string().trim().min(1).max(120),
          cityCode: z.string().trim().min(1).max(64),
          mediaAssetIds: z.array(z.number().int().positive()).min(1).max(10),
          contacts: z.array(contactInput).min(1).max(4),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await createCentralAd(ctx.user.id, input);
        } catch (error) {
          return coreDataError(error);
        }
      }),
  }),
  favorites: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        try {
          return await listFavorites(ctx.user.id, input?.limit ?? 50);
        } catch (error) {
          return coreDataError(error);
        }
      }),
    toggle: protectedProcedure
      .input(z.object({ publicAdId }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await toggleFavorite(ctx.user.id, input.publicAdId);
        } catch (error) {
          return coreDataError(error);
        }
      }),
  }),
  reports: router({
    create: protectedProcedure
      .input(
        z.object({
          publicAdId,
          reason: z.enum(["spam", "fraud", "prohibited", "misleading", "copyright", "other"]),
          details: z.string().trim().max(2000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await createReport(ctx.user.id, input);
        } catch (error) {
          return coreDataError(error);
        }
      }),
  }),
  events: router({
    record: publicProcedure
      .input(
        z.object({
          publicAdId,
          anonymousId: z.string().trim().min(8).max(128).optional(),
          eventType: z.enum([
            "impression",
            "view",
            "share",
            "store_click",
            "product_click",
            "whatsapp_click",
            "phone_click",
          ]),
          idempotencyKey: z.string().trim().min(8).max(96),
          metadata: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user && !input.anonymousId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ANONYMOUS_ID_REQUIRED" });
        }
        try {
          return await recordEventByPublicId({
            publicAdId: input.publicAdId,
            userId: ctx.user?.id,
            anonymousId: input.anonymousId,
            eventType: input.eventType,
            idempotencyKey: input.idempotencyKey,
            metadata: input.metadata,
          });
        } catch (error) {
          return coreDataError(error);
        }
      }),
  }),
});
