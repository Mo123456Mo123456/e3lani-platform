import { and, eq, gte, sql, type SQL } from "drizzle-orm";

import {
  identityActionEvents,
  users,
  visitorSessions,
} from "../drizzle/schema";
import type { AuthenticatedUser } from "./_core/sdk";
import type { AuthenticatedVisitor } from "./visitor-token";

export type ContentIdentity =
  | {
      kind: "user";
      userId: number;
      visitorSessionId: null;
      accountType: string;
    }
  | {
      kind: "visitor";
      userId: null;
      visitorSessionId: number;
      accountType: "visitor";
    };

export function contentIdentity(
  user: AuthenticatedUser | null,
  visitor: AuthenticatedVisitor | null,
): ContentIdentity | null {
  if (user) {
    return {
      kind: "user",
      userId: user.id,
      visitorSessionId: null,
      accountType: user.accountType,
    };
  }
  if (visitor) {
    return {
      kind: "visitor",
      userId: null,
      visitorSessionId: visitor.id,
      accountType: "visitor",
    };
  }
  return null;
}

export function identityWhere(
  identity: ContentIdentity,
  userColumn: { _: unknown },
  visitorColumn: { _: unknown },
): SQL {
  return identity.kind === "user"
    ? eq(userColumn as never, identity.userId)
    : eq(visitorColumn as never, identity.visitorSessionId);
}

export function identityInsert(identity: ContentIdentity) {
  return identity.kind === "user"
    ? { userId: identity.userId, visitorSessionId: null }
    : { userId: null, visitorSessionId: identity.visitorSessionId };
}

/** Serialize rolling-window writes by locking the owning identity row. */
export async function lockIdentity(
  tx: any,
  identity: ContentIdentity,
): Promise<void> {
  if (identity.kind === "user") {
    const rows = await tx
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1)
      .for("update");
    if (!rows[0] || rows[0].status !== "active") throw new Error("IDENTITY_SUSPENDED");
    return;
  }
  const rows = await tx
    .select({ id: visitorSessions.id, status: visitorSessions.status })
    .from(visitorSessions)
    .where(eq(visitorSessions.id, identity.visitorSessionId))
    .limit(1)
    .for("update");
  if (!rows[0] || rows[0].status !== "active") throw new Error("IDENTITY_SUSPENDED");
}

export async function findIdempotentAction(
  tx: any,
  identity: ContentIdentity,
  idempotencyKey: string,
  actionType: "main_ad" | "profile_post" | "report",
) {
  const ownerCondition =
    identity.kind === "user"
      ? eq(identityActionEvents.userId, identity.userId)
      : eq(identityActionEvents.visitorSessionId, identity.visitorSessionId);
  const rows = await tx
    .select({
      contentPublicId: identityActionEvents.contentPublicId,
      actionType: identityActionEvents.actionType,
    })
    .from(identityActionEvents)
    .where(
      and(
        ownerCondition,
        eq(identityActionEvents.actionType, actionType),
        eq(identityActionEvents.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  if (!rows[0]) return null;
  if (rows[0].actionType !== actionType) throw new Error("IDEMPOTENCY_KEY_REUSED");
  return rows[0].contentPublicId;
}

export async function enforceRollingLimit(
  tx: any,
  input: {
    identity: ContentIdentity;
    actionType: "main_ad" | "profile_post" | "report";
    limit: number;
    now?: Date;
  },
) {
  const since = new Date((input.now ?? new Date()).getTime() - 24 * 60 * 60 * 1000);
  const identityCondition =
    input.identity.kind === "user"
      ? eq(identityActionEvents.userId, input.identity.userId)
      : eq(identityActionEvents.visitorSessionId, input.identity.visitorSessionId);
  const rows = await tx
    .select({ count: sql<number>`count(*)` })
    .from(identityActionEvents)
    .where(
      and(
        identityCondition,
        eq(identityActionEvents.actionType, input.actionType),
        gte(identityActionEvents.createdAt, since),
      ),
    );
  const count = Number(rows[0]?.count ?? 0);
  if (count >= input.limit) {
    const error =
      input.actionType === "main_ad"
        ? "MAIN_AD_DAILY_LIMIT_REACHED"
        : input.actionType === "profile_post"
          ? "PROFILE_POST_DAILY_LIMIT_REACHED"
          : "REPORT_DAILY_LIMIT_REACHED";
    throw new Error(`${error}:${input.limit}`);
  }
  return { count, remaining: Math.max(0, input.limit - count) };
}

export async function recordIdentityAction(
  tx: any,
  input: {
    identity: ContentIdentity;
    actionType: "main_ad" | "profile_post" | "report";
    contentPublicId: string;
    idempotencyKey: string;
  },
) {
  await tx.insert(identityActionEvents).values({
    ...identityInsert(input.identity),
    actionType: input.actionType,
    contentPublicId: input.contentPublicId,
    idempotencyKey: input.idempotencyKey,
  });
}

