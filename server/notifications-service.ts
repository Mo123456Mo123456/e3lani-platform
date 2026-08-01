import { and, desc, eq, isNull } from "drizzle-orm";

import { notifications } from "../drizzle/schema";
import { getDb, requireDatabase } from "./db";

export type NotifyInput = {
  userId: number;
  type: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  entityType?: string | null;
  entityId?: string | null;
};

export async function createNotification(input: NotifyInput) {
  const db = requireDatabase(await getDb());
  const inserted = await db.insert(notifications).values({
    userId: input.userId,
    type: input.type.slice(0, 64),
    titleAr: input.titleAr.slice(0, 180),
    titleEn: input.titleEn.slice(0, 180),
    bodyAr: input.bodyAr,
    bodyEn: input.bodyEn,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
  });
  return { id: Number(inserted[0].insertId) };
}

export async function listNotifications(userId: number, limit = 50) {
  const db = requireDatabase(await getDb());
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = requireDatabase(await getDb());
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  return { ok: true as const };
}

export async function markAllNotificationsRead(userId: number) {
  const db = requireDatabase(await getDb());
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return { ok: true as const };
}

export async function notifyAdPublished(userId: number, publicAdId: string, title: string) {
  return createNotification({
    userId,
    type: "ad.published",
    titleAr: "تم نشر إعلانك",
    titleEn: "Your ad was published",
    bodyAr: `${title} أصبح ظاهرًا في الموجز العالمي.`,
    bodyEn: `${title} is now visible in the global feed.`,
    entityType: "ad",
    entityId: publicAdId,
  });
}

export async function notifyAdPaused(userId: number, publicAdId: string, reason: string) {
  return createNotification({
    userId,
    type: "ad.paused",
    titleAr: "تم إيقاف إعلانك",
    titleEn: "Your ad was paused",
    bodyAr: reason,
    bodyEn: reason,
    entityType: "ad",
    entityId: publicAdId,
  });
}
