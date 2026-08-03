import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar, tinyint } from "drizzle-orm/mysql-core";
import { businessProfiles, users } from "./accounts";
import { categories, cities } from "./catalog";

export const mediaAssets = mysqlTable("media_assets", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").references(() => users.id),
  /** FK to visitor_sessions is applied in migration 0010 to avoid schema cycles. */
  ownerVisitorSessionId: int("ownerVisitorSessionId"),
  storageKey: varchar("storageKey", { length: 768 }).notNull(),
  originalUrl: varchar("originalUrl", { length: 1024 }).notNull(),
  mediaType: mysqlEnum("mediaType", ["image", "video"]).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  bytes: int("bytes").notNull(),
  width: int("width"),
  height: int("height"),
  durationMs: int("durationMs"),
  processingStatus: mysqlEnum("processingStatus", ["uploaded", "queued", "processing", "ready", "failed"]).default("uploaded").notNull(),
  variants: json("variants"),
  failureReason: text("failureReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("media_assets_storageKey_unique").on(table.storageKey),
]);

export const ads = mysqlTable("ads", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 24 }).notNull(),
  ownerId: int("ownerId").references(() => users.id),
  /** Signed guest identity owner; never returned by public APIs. */
  ownerVisitorSessionId: int("ownerVisitorSessionId"),
  /** FK to advertiser_profiles is applied in migration 0010. */
  advertiserProfileId: int("advertiserProfileId"),
  businessProfileId: int("businessProfileId").references(() => businessProfiles.id),
  categoryId: int("categoryId").notNull().references(() => categories.id),
  cityId: int("cityId").notNull().references(() => cities.id),
  countryCode: varchar("countryCode", { length: 2 }).default("SA").notNull(),
  currentRevisionId: int("currentRevisionId"),
  pendingRevisionId: int("pendingRevisionId"),
  adStatus: mysqlEnum("adStatus", ["draft", "awaiting_payment", "pending_review", "changes_requested", "active", "paused", "rejected", "expired", "removed"]).default("draft").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["not_required", "unpaid", "pending", "paid", "failed", "refunded", "partially_refunded"]).default("unpaid").notNull(),
  mediaStatus: mysqlEnum("mediaStatus", ["empty", "uploading", "processing", "ready", "failed"]).default("empty").notNull(),
  moderationStatus: mysqlEnum("moderationStatus", ["not_submitted", "queued", "in_review", "approved", "changes_requested", "rejected"]).default("not_submitted").notNull(),
  adminHold: tinyint("adminHold").default(0).notNull(),
  adminHoldReason: varchar("adminHoldReason", { length: 500 }),
  activatedAt: timestamp("activatedAt"),
  expiresAt: timestamp("expiresAt"),
  pausedAt: timestamp("pausedAt"),
  lastRepublishedAt: timestamp("lastRepublishedAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("ads_publicId_unique").on(table.publicId),
  index("ads_feed_idx").on(table.adStatus, table.cityId, table.categoryId, table.activatedAt),
  index("ads_country_feed_idx").on(table.adStatus, table.countryCode, table.activatedAt),
  index("ads_owner_idx").on(table.ownerId, table.adStatus),
  index("ads_visitor_owner_idx").on(table.ownerVisitorSessionId, table.adStatus),
  index("ads_advertiser_profile_idx").on(table.advertiserProfileId, table.adStatus),
]);

export const adRevisions = mysqlTable("ad_revisions", {
  id: int("id").autoincrement().primaryKey(),
  adId: int("adId").notNull().references(() => ads.id),
  version: int("version").notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  description: text("description").notNull(),
  customCityName: varchar("customCityName", { length: 120 }),
  audienceScope: mysqlEnum("audienceScope", ["city", "region", "kingdom"]).default("city").notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["draft", "queued", "in_review", "approved", "changes_requested", "rejected"]).default("draft").notNull(),
  submittedAt: timestamp("submittedAt"),
  decidedAt: timestamp("decidedAt"),
  decisionReason: text("decisionReason"),
  createdBy: int("createdBy").references(() => users.id),
  createdByVisitorSessionId: int("createdByVisitorSessionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("ad_revision_version_uq").on(table.adId, table.version),
]);

export const adMedia = mysqlTable("ad_media", {
  id: int("id").autoincrement().primaryKey(),
  revisionId: int("revisionId").notNull().references(() => adRevisions.id),
  mediaAssetId: int("mediaAssetId").notNull().references(() => mediaAssets.id),
  sortOrder: int("sortOrder").default(0).notNull(),
  altTextAr: varchar("altTextAr", { length: 240 }),
  altTextEn: varchar("altTextEn", { length: 240 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ad_media_order_uq").on(table.revisionId, table.sortOrder),
  uniqueIndex("ad_media_asset_uq").on(table.revisionId, table.mediaAssetId),
]);

export const adContacts = mysqlTable("ad_contacts", {
  id: int("id").autoincrement().primaryKey(),
  revisionId: int("revisionId").notNull().references(() => adRevisions.id),
  contactType: mysqlEnum("contactType", ["store", "product", "whatsapp", "phone"]).notNull(),
  contactValue: varchar("contactValue", { length: 1024 }).notNull(),
  isVerified: tinyint("isVerified").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const adEvents = mysqlTable("ad_events", {
  id: int("id").autoincrement().primaryKey(),
  adId: int("adId").notNull().references(() => ads.id),
  userId: int("userId").references(() => users.id),
  anonymousId: varchar("anonymousId", { length: 128 }),
  eventType: mysqlEnum("eventType", ["impression", "view", "save", "share", "store_click", "product_click", "whatsapp_click", "phone_click", "report"]).notNull(),
  dedupeKey: varchar("dedupeKey", { length: 160 }).notNull(),
  metadata: json("metadata"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ad_events_dedupeKey_unique").on(table.dedupeKey),
  index("ad_events_rollup_idx").on(table.adId, table.eventType, table.occurredAt),
]);

export const adMetricsDaily = mysqlTable("ad_metrics_daily", {
  id: int("id").autoincrement().primaryKey(),
  adId: int("adId").notNull().references(() => ads.id),
  metricDate: varchar("metricDate", { length: 10 }).notNull(),
  impressions: int("impressions").default(0).notNull(),
  views: int("views").default(0).notNull(),
  saves: int("saves").default(0).notNull(),
  shares: int("shares").default(0).notNull(),
  contactIntents: int("contactIntents").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("ad_metric_day_uq").on(table.adId, table.metricDate),
]);

export type Ad = typeof ads.$inferSelect;
export type AdRevision = typeof adRevisions.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
