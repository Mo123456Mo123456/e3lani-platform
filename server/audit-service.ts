import { desc, eq } from "drizzle-orm";

import { auditLogs } from "../drizzle/schema";
import { getDb, requireDatabase } from "./db";

export type AuditWriteInput = {
  actorId?: number | null;
  actorVisitorSessionId?: number | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionTokenId?: string | null;
};

export async function writeAuditLog(input: AuditWriteInput) {
  const db = requireDatabase(await getDb());
  await db.insert(auditLogs).values({
    actorId: input.actorId ?? null,
    actorVisitorSessionId: input.actorVisitorSessionId ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action.slice(0, 120),
    entityType: input.entityType.slice(0, 64),
    entityId: String(input.entityId).slice(0, 64),
    reason: input.reason ?? null,
    beforeState: input.beforeState ?? null,
    afterState: {
      ...(typeof input.afterState === "object" && input.afterState ? input.afterState : { value: input.afterState }),
      sessionTokenId: input.sessionTokenId ?? null,
    },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent?.slice(0, 768) ?? null,
  });
  return { ok: true as const };
}

export async function listAuditLogs(limit = 100) {
  const db = requireDatabase(await getDb());
  return db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}

export async function listAuditLogsForEntity(entityType: string, entityId: string, limit = 50) {
  const db = requireDatabase(await getDb());
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.entityType, entityType))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .then((rows) => rows.filter((row) => row.entityId === entityId));
}
