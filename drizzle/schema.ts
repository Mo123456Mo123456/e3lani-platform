import { boolean, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "reviewer", "support", "finance", "admin", "owner"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().unique(), phone: varchar("phone", { length: 32 }),
  displayName: varchar("displayName", { length: 140 }), bio: text("bio"), cityId: int("cityId"),
  accountType: mysqlEnum("accountType", ["viewer", "advertiser", "brand"]).default("viewer").notNull(),
  preferredLanguage: mysqlEnum("preferredLanguage", ["ar", "en"]).default("ar").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userIdx: uniqueIndex("profiles_user_idx").on(table.userId) }));

export const cities = mysqlTable("cities", {
  id: int("id").autoincrement().primaryKey(), code: varchar("code", { length: 64 }).notNull().unique(),
  nameAr: varchar("nameAr", { length: 120 }).notNull(), nameEn: varchar("nameEn", { length: 120 }).notNull(),
  region: varchar("region", { length: 120 }).notNull(), isActive: boolean("isActive").default(true).notNull(), sortOrder: int("sortOrder").default(0).notNull(),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(), parentId: int("parentId"), slug: varchar("slug", { length: 80 }).notNull().unique(),
  nameAr: varchar("nameAr", { length: 120 }).notNull(), nameEn: varchar("nameEn", { length: 120 }).notNull(), icon: varchar("icon", { length: 80 }),
  reviewPolicy: mysqlEnum("reviewPolicy", ["standard", "strict"]).default("standard").notNull(), isActive: boolean("isActive").default(true).notNull(), sortOrder: int("sortOrder").default(0).notNull(),
});

export const businessProfiles = mysqlTable("businessProfiles", {
  id: int("id").autoincrement().primaryKey(), ownerId: int("ownerId").notNull(), slug: varchar("slug", { length: 100 }).notNull().unique(),
  displayName: varchar("displayName", { length: 160 }).notNull(), legalName: varchar("legalName", { length: 200 }), bio: text("bio"),
  logoUrl: text("logoUrl"), coverUrl: text("coverUrl"), websiteUrl: text("websiteUrl"),
  verificationStatus: mysqlEnum("verificationStatus", ["unverified", "pending", "verified", "rejected"]).default("unverified").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ ownerIdx: index("business_owner_idx").on(table.ownerId) }));

export const ads = mysqlTable("ads", {
  id: int("id").autoincrement().primaryKey(), publicId: varchar("publicId", { length: 32 }).notNull().unique(), ownerId: int("ownerId").notNull(),
  businessProfileId: int("businessProfileId"), categoryId: int("categoryId").notNull(), cityId: int("cityId").notNull(),
  status: mysqlEnum("status", ["draft", "awaiting_payment", "pending_review", "changes_requested", "active", "paused", "rejected", "expired", "removed"]).default("draft").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "pending", "paid", "failed", "refunded"]).default("unpaid").notNull(),
  mediaStatus: mysqlEnum("mediaStatus", ["empty", "uploading", "processing", "ready", "failed"]).default("empty").notNull(),
  moderationStatus: mysqlEnum("moderationStatus", ["not_submitted", "queued", "in_review", "approved", "changes_requested", "rejected"]).default("not_submitted").notNull(),
  currentRevisionId: int("currentRevisionId"), pendingRevisionId: int("pendingRevisionId"), activatedAt: timestamp("activatedAt"), expiresAt: timestamp("expiresAt"), lastRepublishedAt: timestamp("lastRepublishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), deletedAt: timestamp("deletedAt"),
}, (table) => ({ feedIdx: index("ads_feed_idx").on(table.status, table.cityId, table.categoryId), ownerIdx: index("ads_owner_idx").on(table.ownerId) }));

export const adRevisions = mysqlTable("adRevisions", {
  id: int("id").autoincrement().primaryKey(), adId: int("adId").notNull(), version: int("version").notNull(), title: varchar("title", { length: 140 }).notNull(),
  description: text("description").notNull(), audienceScope: mysqlEnum("audienceScope", ["city", "region", "kingdom"]).default("city").notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["draft", "queued", "in_review", "approved", "changes_requested", "rejected"]).default("draft").notNull(),
  reviewReason: text("reviewReason"), createdBy: int("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ adVersionIdx: uniqueIndex("ad_revision_version_idx").on(table.adId, table.version) }));

export const mediaAssets = mysqlTable("mediaAssets", {
  id: int("id").autoincrement().primaryKey(), ownerId: int("ownerId").notNull(), mediaType: mysqlEnum("mediaType", ["image", "video"]).notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(), originalUrl: text("originalUrl").notNull(), mimeType: varchar("mimeType", { length: 120 }).notNull(),
  bytes: int("bytes").notNull(), width: int("width"), height: int("height"), durationMs: int("durationMs"), status: mysqlEnum("status", ["uploading", "processing", "ready", "failed"]).default("ready").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const adMedia = mysqlTable("adMedia", { id: int("id").autoincrement().primaryKey(), revisionId: int("revisionId").notNull(), mediaAssetId: int("mediaAssetId").notNull(), sortOrder: int("sortOrder").default(0).notNull(), altTextAr: varchar("altTextAr", { length: 220 }), altTextEn: varchar("altTextEn", { length: 220 }) });
export const adContacts = mysqlTable("adContacts", { id: int("id").autoincrement().primaryKey(), revisionId: int("revisionId").notNull(), type: mysqlEnum("type", ["store", "product", "whatsapp", "phone"]).notNull(), value: text("value").notNull(), sortOrder: int("sortOrder").default(0).notNull() });

export const pricingVersions = mysqlTable("pricingVersions", {
  id: int("id").autoincrement().primaryKey(), version: int("version").notNull().unique(), basePriceHalalas: int("basePriceHalalas").default(5900).notNull(),
  vatBasisPoints: int("vatBasisPoints").default(1500).notNull(), currency: varchar("currency", { length: 3 }).default("SAR").notNull(), rules: json("rules").notNull(),
  isActive: boolean("isActive").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(), publicId: varchar("publicId", { length: 40 }).notNull().unique(), ownerId: int("ownerId").notNull(), adId: int("adId").notNull(),
  kind: mysqlEnum("kind", ["publication", "extension", "republish", "promotion"]).default("publication").notNull(), status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  channel: mysqlEnum("channel", ["web", "apple_iap", "google_play"]).notNull(), idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull().unique(),
  subtotalHalalas: int("subtotalHalalas").notNull(), vatHalalas: int("vatHalalas").notNull(), totalHalalas: int("totalHalalas").notNull(), currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  pricingSnapshot: json("pricingSnapshot").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), paidAt: timestamp("paidAt"),
}, (table) => ({ ownerIdx: index("orders_owner_idx").on(table.ownerId), adIdx: index("orders_ad_idx").on(table.adId) }));

export const payments = mysqlTable("payments", { id: int("id").autoincrement().primaryKey(), orderId: int("orderId").notNull(), provider: varchar("provider", { length: 100 }).notNull(), providerReference: varchar("providerReference", { length: 200 }), status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(), receipt: json("receipt"), createdAt: timestamp("createdAt").defaultNow().notNull(), confirmedAt: timestamp("confirmedAt") });
export const invoices = mysqlTable("invoices", { id: int("id").autoincrement().primaryKey(), publicId: varchar("publicId", { length: 40 }).notNull().unique(), invoiceNumber: varchar("invoiceNumber", { length: 60 }).notNull().unique(), orderId: int("orderId").notNull(), ownerId: int("ownerId").notNull(), totalHalalas: int("totalHalalas").notNull(), vatHalalas: int("vatHalalas").notNull(), currency: varchar("currency", { length: 3 }).default("SAR").notNull(), issuedAt: timestamp("issuedAt").defaultNow().notNull() });
export const favorites = mysqlTable("favorites", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), adId: int("adId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ uniqueFavorite: uniqueIndex("favorites_unique_idx").on(table.userId, table.adId) }));
export const reports = mysqlTable("reports", { id: int("id").autoincrement().primaryKey(), publicId: varchar("publicId", { length: 40 }).notNull().unique(), reporterId: int("reporterId").notNull(), adId: int("adId").notNull(), reason: varchar("reason", { length: 160 }).notNull(), details: text("details"), status: mysqlEnum("status", ["open", "resolved", "dismissed"]).default("open").notNull(), resolution: text("resolution"), createdAt: timestamp("createdAt").defaultNow().notNull(), resolvedAt: timestamp("resolvedAt") });
export const adEvents = mysqlTable("adEvents", { id: int("id").autoincrement().primaryKey(), adId: int("adId").notNull(), userId: int("userId"), anonymousId: varchar("anonymousId", { length: 128 }), type: mysqlEnum("type", ["impression", "view", "save", "share", "store_click", "product_click", "whatsapp_click", "phone_click", "report"]).notNull(), dedupeKey: varchar("dedupeKey", { length: 180 }).notNull().unique(), metadata: json("metadata"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ adTypeIdx: index("events_ad_type_idx").on(table.adId, table.type) }));
export const notifications = mysqlTable("notifications", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), type: varchar("type", { length: 80 }).notNull(), title: varchar("title", { length: 180 }).notNull(), body: text("body").notNull(), entityType: varchar("entityType", { length: 60 }), entityId: varchar("entityId", { length: 80 }), isRead: boolean("isRead").default(false).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
export const auditLogs = mysqlTable("auditLogs", { id: int("id").autoincrement().primaryKey(), actorId: int("actorId"), actorRole: varchar("actorRole", { length: 40 }).notNull(), action: varchar("action", { length: 120 }).notNull(), targetType: varchar("targetType", { length: 80 }).notNull(), targetId: varchar("targetId", { length: 80 }).notNull(), reason: text("reason").notNull(), beforeValue: json("beforeValue"), afterValue: json("afterValue"), ipAddress: varchar("ipAddress", { length: 64 }), userAgent: text("userAgent"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ targetIdx: index("audit_target_idx").on(table.targetType, table.targetId) }));
