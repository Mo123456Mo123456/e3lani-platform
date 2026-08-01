import { and, desc, eq, inArray } from "drizzle-orm";

import { adRevisions, ads, moderationCases } from "../drizzle/schema";
import { writeAuditLog } from "./audit-service";
import { getDb, requireDatabase } from "./db";
import { notifyAdPaused, notifyAdPublished } from "./notifications-service";

export async function listModerationQueue(limit = 50) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({
      caseId: moderationCases.id,
      status: moderationCases.status,
      riskScore: moderationCases.riskScore,
      decisionReason: moderationCases.decisionReason,
      automatedSignals: moderationCases.automatedSignals,
      createdAt: moderationCases.createdAt,
      adPublicId: ads.publicId,
      adStatus: ads.adStatus,
      title: adRevisions.title,
      countryCode: ads.countryCode,
      ownerId: ads.ownerId,
    })
    .from(moderationCases)
    .innerJoin(ads, eq(moderationCases.adId, ads.id))
    .leftJoin(adRevisions, eq(ads.currentRevisionId, adRevisions.id))
    .where(inArray(moderationCases.status, ["queued", "in_review", "appealed"]))
    .orderBy(desc(moderationCases.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function decideModerationCase(input: {
  actorId: number;
  caseId: number;
  decision: "approve" | "reject" | "request_changes";
  reason?: string;
}) {
  const db = requireDatabase(await getDb());
  const cases = await db
    .select({
      id: moderationCases.id,
      adId: moderationCases.adId,
      status: moderationCases.status,
    })
    .from(moderationCases)
    .where(eq(moderationCases.id, input.caseId))
    .limit(1);
  if (!cases[0]) throw new Error("MODERATION_CASE_NOT_FOUND");

  const adRows = await db.select().from(ads).where(eq(ads.id, cases[0].adId)).limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");

  const now = new Date();
  const reason = input.reason?.trim() || null;

  if (input.decision === "approve") {
    await db
      .update(moderationCases)
      .set({
        status: "approved",
        decisionReason: reason,
        decidedAt: now,
        assignedTo: input.actorId,
      })
      .where(eq(moderationCases.id, input.caseId));
    await db
      .update(ads)
      .set({
        adStatus: "active",
        moderationStatus: "approved",
        pausedAt: null,
        activatedAt: adRows[0].activatedAt ?? now,
      })
      .where(eq(ads.id, adRows[0].id));
    const rev = await db
      .select({ title: adRevisions.title })
      .from(adRevisions)
      .where(eq(adRevisions.id, adRows[0].currentRevisionId!))
      .limit(1)
      .catch(() => []);
    await notifyAdPublished(adRows[0].ownerId, adRows[0].publicId, rev[0]?.title ?? adRows[0].publicId).catch(
      () => undefined,
    );
  } else if (input.decision === "reject") {
    await db
      .update(moderationCases)
      .set({
        status: "rejected",
        decisionReason: reason,
        decidedAt: now,
        assignedTo: input.actorId,
      })
      .where(eq(moderationCases.id, input.caseId));
    await db
      .update(ads)
      .set({
        adStatus: "paused",
        moderationStatus: "rejected",
        pausedAt: now,
      })
      .where(eq(ads.id, adRows[0].id));
    await notifyAdPaused(
      adRows[0].ownerId,
      adRows[0].publicId,
      reason || "Rejected by moderation",
    ).catch(() => undefined);
  } else {
    await db
      .update(moderationCases)
      .set({
        status: "changes_requested",
        decisionReason: reason,
        decidedAt: now,
        assignedTo: input.actorId,
      })
      .where(eq(moderationCases.id, input.caseId));
    await db
      .update(ads)
      .set({
        adStatus: "pending_review",
        moderationStatus: "changes_requested",
        pausedAt: null,
        activatedAt: null,
      })
      .where(eq(ads.id, adRows[0].id));
  }

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "admin",
    action: `moderation.${input.decision}`,
    entityType: "moderation_case",
    entityId: String(input.caseId),
    reason,
    beforeState: { status: cases[0].status, adStatus: adRows[0].adStatus },
    afterState: { decision: input.decision, adPublicId: adRows[0].publicId },
  }).catch(() => undefined);

  return { ok: true as const };
}

export async function listOpenCasesForAd(publicAdId: string) {
  const db = requireDatabase(await getDb());
  const adRows = await db.select({ id: ads.id }).from(ads).where(eq(ads.publicId, publicAdId)).limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  return db
    .select()
    .from(moderationCases)
    .where(and(eq(moderationCases.adId, adRows[0].id)))
    .orderBy(desc(moderationCases.id))
    .limit(10);
}
