import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { User } from "../../drizzle/schema";
import type { TrpcContext } from "./context";
import { contentIdentity } from "../content-identity";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.status !== "active" || ctx.user.deletedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account is not active (10003)" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireIdentity = t.middleware(async ({ ctx, next }) => {
  const identity = contentIdentity(ctx.user, ctx.visitor);
  if (!identity) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "IDENTITY_REQUIRED" });
  }
  return next({
    ctx: {
      ...ctx,
      identity,
    },
  });
});

/** Allows either an active account session or a signed, active guest identity. */
export const identityProcedure = t.procedure.use(requireIdentity);

type UserRole = User["role"];

function procedureForRoles(...allowedRoles: UserRole[]) {
  return protectedProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      const user = ctx.user;
      if (!user || !allowedRoles.includes(user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }
      return next({
        ctx: {
          ...ctx,
          user,
        },
      });
    }),
  );
}

export const reviewerProcedure = procedureForRoles("reviewer", "admin", "owner");
export const financeProcedure = procedureForRoles("finance", "admin", "owner");
export const supportProcedure = procedureForRoles("support", "admin", "owner");
export const staffProcedure = procedureForRoles(
  "reviewer",
  "finance",
  "support",
  "admin",
  "owner",
);
export const adminProcedure = procedureForRoles("admin", "owner");
export const ownerProcedure = procedureForRoles("owner");
