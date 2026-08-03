import { and, desc, eq, inArray } from "drizzle-orm";

import {
  advertiserProfiles,
  ads,
  profilePosts,
  reportActions,
  reports,
  users,
  visitorSessions,
} from "../drizzle/schema";
import { writeAuditLog } from "./audit-service";
import { getDb, requireDatabase } from "./db";

export async function listReports(input?: {
  status?: "open" | "assigned" | "resolved" | "dismissed";
  limit?: number;
}) {
  const db = requireDatabase(await getDb());
  const conditions = input?.status
    ? eq(reports.status, input.status)
    : inArray(reports.status, ["open", "assigned"]);
  const rows = await db
    .select({
      id: reports.publicId,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      createdAt: reports.createdAt,
      reporterUserId: reports.reporterId,
      reporterVisitorSessionId: reports.reporterVisitorSessionId,
      reporterName: users.name,
      adId: ads.publicId,
      adStatus: ads.adStatus,
      postId: profilePosts.publicId,
      postStatus: profilePosts.postStatus,
      profileUsername: advertiserProfiles.username,
    })
    .from(reports)
    .leftJoin(users, eq(reports.reporterId, users.id))
    .leftJoin(ads, eq(reports.adId, ads.id))
    .leftJoin(profilePosts, eq(reports.profilePostId, profilePosts.id))
    .leftJoin(
      advertiserProfiles,
      eq(profilePosts.advertiserProfileId, advertiserProfiles.id),
    )
    .where(conditions)
    .orderBy(desc(reports.createdAt))
    .limit(Math.min(Math.max(input?.limit ?? 100, 1), 500));
  return rows.map((row) => ({
    ...row,
    contentType: row.postId ? ("profile_post" as const) : ("main_ad" as const),
    contentId: row.postId ?? row.adId,
    contentStatus: row.postStatus ?? row.adStatus,
    reporterType: row.reporterUserId
      ? ("user" as const)
      : row.reporterVisitorSessionId
        ? ("visitor" as const)
        : ("unknown" as const),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function decideReport(input: {
  actorId: number;
  reportPublicId: string;
  action: "dismiss" | "resolve" | "remove_content" | "restore_content" | "suspend_reporter";
  reason: string;
}) {
  const db = requireDatabase(await getDb());
  const reportRows = await db
    .select()
    .from(reports)
    .where(eq(reports.publicId, input.reportPublicId))
    .limit(1);
  const report = reportRows[0];
  if (!report) throw new Error("REPORT_NOT_FOUND");
  const now = new Date();
  const reason = input.reason.trim().slice(0, 1000);
  if (!reason) throw new Error("REPORT_DECISION_REASON_REQUIRED");

  let recordedAction: typeof reportActions.$inferInsert.action;
  await db.transaction(async (tx) => {
    if (input.action === "dismiss") {
      recordedAction = "dismiss";
      await tx
        .update(reports)
        .set({ status: "dismissed", resolvedAt: now, assignedTo: input.actorId })
        .where(eq(reports.id, report.id));
    } else if (input.action === "resolve") {
      recordedAction = "resolve";
      await tx
        .update(reports)
        .set({ status: "resolved", resolvedAt: now, assignedTo: input.actorId })
        .where(eq(reports.id, report.id));
    } else if (input.action === "remove_content") {
      if (report.adId) {
        recordedAction = "remove_ad";
        await tx
          .update(ads)
          .set({ adStatus: "removed", deletedAt: now, pausedAt: now })
          .where(eq(ads.id, report.adId));
      } else if (report.profilePostId) {
        recordedAction = "remove_post";
        await tx
          .update(profilePosts)
          .set({ postStatus: "removed", deletedAt: now })
          .where(eq(profilePosts.id, report.profilePostId));
      } else {
        throw new Error("REPORT_CONTENT_NOT_FOUND");
      }
      await tx
        .update(reports)
        .set({ status: "resolved", resolvedAt: now, assignedTo: input.actorId })
        .where(eq(reports.id, report.id));
    } else if (input.action === "restore_content") {
      if (report.adId) {
        recordedAction = "restore_ad";
        await tx
          .update(ads)
          .set({ adStatus: "active", deletedAt: null, pausedAt: null })
          .where(eq(ads.id, report.adId));
      } else if (report.profilePostId) {
        recordedAction = "restore_post";
        await tx
          .update(profilePosts)
          .set({ postStatus: "active", deletedAt: null })
          .where(eq(profilePosts.id, report.profilePostId));
      } else {
        throw new Error("REPORT_CONTENT_NOT_FOUND");
      }
    } else if (report.reporterId) {
      recordedAction = "suspend_user";
      await tx
        .update(users)
        .set({ status: "suspended" })
        .where(eq(users.id, report.reporterId));
    } else if (report.reporterVisitorSessionId) {
      recordedAction = "suspend_visitor";
      const visitor = await tx
        .select({ tokenVersion: visitorSessions.tokenVersion })
        .from(visitorSessions)
        .where(eq(visitorSessions.id, report.reporterVisitorSessionId))
        .limit(1);
      if (!visitor[0]) throw new Error("VISITOR_NOT_FOUND");
      await tx
        .update(visitorSessions)
        .set({
          status: "suspended",
          tokenVersion: visitor[0].tokenVersion + 1,
        })
        .where(eq(visitorSessions.id, report.reporterVisitorSessionId));
      await tx
        .update(advertiserProfiles)
        .set({ status: "suspended" })
        .where(eq(advertiserProfiles.visitorSessionId, report.reporterVisitorSessionId));
    } else {
      throw new Error("REPORT_REPORTER_NOT_FOUND");
    }

    await tx.insert(reportActions).values({
      reportId: report.id,
      actorId: input.actorId,
      action: recordedAction!,
      reason,
    });
  });

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "admin",
    action: `report.${input.action}`,
    entityType: "report",
    entityId: input.reportPublicId,
    reason,
    beforeState: { status: report.status },
    afterState: { action: input.action },
  });
  return { ok: true as const };
}

export async function setIdentitySuspension(input: {
  actorId: number;
  subjectType: "user" | "visitor";
  subjectId: number;
  suspended: boolean;
  reason: string;
}) {
  const db = requireDatabase(await getDb());
  const reason = input.reason.trim().slice(0, 1000);
  if (!reason) throw new Error("SUSPENSION_REASON_REQUIRED");
  if (input.subjectType === "user") {
    await db
      .update(users)
      .set({ status: input.suspended ? "suspended" : "active" })
      .where(eq(users.id, input.subjectId));
  } else {
    const rows = await db
      .select({ tokenVersion: visitorSessions.tokenVersion })
      .from(visitorSessions)
      .where(eq(visitorSessions.id, input.subjectId))
      .limit(1);
    if (!rows[0]) throw new Error("VISITOR_NOT_FOUND");
    await db
      .update(visitorSessions)
      .set({
        status: input.suspended ? "suspended" : "active",
        tokenVersion: rows[0].tokenVersion + 1,
      })
      .where(eq(visitorSessions.id, input.subjectId));
    await db
      .update(advertiserProfiles)
      .set({ status: input.suspended ? "suspended" : "active" })
      .where(eq(advertiserProfiles.visitorSessionId, input.subjectId));
  }
  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "admin",
    action: input.suspended ? "identity.suspend" : "identity.restore",
    entityType: input.subjectType,
    entityId: String(input.subjectId),
    reason,
  });
  return { ok: true as const };
}

