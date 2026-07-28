import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getMyAdvertiserProfile,
  getPublicAdvertiserProfile,
  upsertAdvertiserProfile,
} from "./advertiser-service";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

function advertiserError(error: unknown): never {
  const message = error instanceof Error ? error.message : "ADVERTISER_OPERATION_FAILED";
  if (message.endsWith("_NOT_FOUND")) {
    throw new TRPCError({ code: "NOT_FOUND", message });
  }
  if (message === "ADVERTISER_SLUG_TAKEN") {
    throw new TRPCError({ code: "CONFLICT", message });
  }
  if (
    message.endsWith("_INVALID") ||
    message.endsWith("_RESERVED") ||
    message.endsWith("_TOO_LONG") ||
    message.endsWith("_URL_INVALID")
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "ADVERTISER_OPERATION_FAILED",
    cause: error,
  });
}

export const advertiserRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getMyAdvertiserProfile(ctx.user.id);
    } catch (error) {
      return advertiserError(error);
    }
  }),
  upsert: protectedProcedure
    .input(
      z.object({
        displayName: z.string().trim().min(2).max(120),
        slug: z.string().trim().min(3).max(120),
        bio: z.string().trim().max(1000).optional(),
        websiteUrl: z.string().trim().max(1024).optional(),
        logoUrl: z.string().trim().max(1024).optional(),
        coverUrl: z.string().trim().max(1024).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await upsertAdvertiserProfile(ctx.user.id, input);
      } catch (error) {
        return advertiserError(error);
      }
    }),
  public: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(120) }))
    .query(async ({ input }) => {
      try {
        return await getPublicAdvertiserProfile(input.slug);
      } catch (error) {
        return advertiserError(error);
      }
    }),
});
