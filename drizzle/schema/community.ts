import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  tinyint,
} from "drizzle-orm/mysql-core";

import { users } from "./accounts";
import { adMedia, ads, mediaAssets } from "./content";
import { visitorSessions } from "./countries";

/** Public advertiser identity shared by signed-in accounts and anonymous visitors. */
export const advertiserProfiles = mysqlTable("advertiser_profiles", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  userId: int("userId").references(() => users.id),
  visitorSessionId: int("visitorSessionId").references(() => visitorSessions.id),
  username: varchar("username", { length: 64 }).notNull(),
  displayName: varchar("displayName", { length: 120 }).notNull(),
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  coverUrl: varchar("coverUrl", { length: 1024 }),
  bio: varchar("bio", { length: 280 }),
  isVerified: tinyint("isVerified").default(0).notNull(),
  tiktokUrl: varchar("tiktokUrl", { length: 1024 }),
  snapchatUrl: varchar("snapchatUrl", { length: 1024 }),
  instagramUrl: varchar("instagramUrl", { length: 1024 }),
  whatsappUrl: varchar("whatsappUrl", { length: 1024 }),
  websiteUrl: varchar("websiteUrl", { length: 1024 }),
  storeUrl: varchar("storeUrl", { length: 1024 }),
  status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("advertiser_profiles_publicId_unique").on(table.publicId),
  uniqueIndex("advertiser_profiles_username_unique").on(table.username),
  uniqueIndex("advertiser_profiles_user_unique").on(table.userId),
  uniqueIndex("advertiser_profiles_visitor_unique").on(table.visitorSessionId),
]);

/** Profile posts are deliberately separate from main ads and never feed ads.feed. */
export const profilePosts = mysqlTable("profile_posts", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  advertiserProfileId: int("advertiserProfileId").notNull().references(() => advertiserProfiles.id),
  ownerId: int("ownerId").references(() => users.id),
  ownerVisitorSessionId: int("ownerVisitorSessionId").references(() => visitorSessions.id),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description").notNull(),
  postStatus: mysqlEnum("postStatus", ["active", "paused", "removed"]).default("active").notNull(),
  moderationStatus: mysqlEnum("moderationStatus", [
    "not_submitted",
    "queued",
    "approved",
    "rejected",
  ]).default("approved").notNull(),
  views: int("views").default(0).notNull(),
  shares: int("shares").default(0).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("profile_posts_publicId_unique").on(table.publicId),
  index("profile_posts_profile_feed_idx").on(
    table.advertiserProfileId,
    table.postStatus,
    table.createdAt,
  ),
  index("profile_posts_user_owner_idx").on(table.ownerId, table.createdAt),
  index("profile_posts_visitor_owner_idx").on(table.ownerVisitorSessionId, table.createdAt),
]);

export const profilePostMedia = mysqlTable("profile_post_media", {
  id: int("id").autoincrement().primaryKey(),
  profilePostId: int("profilePostId").notNull().references(() => profilePosts.id),
  mediaAssetId: int("mediaAssetId").notNull().references(() => mediaAssets.id),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("profile_post_media_order_unique").on(table.profilePostId, table.sortOrder),
  uniqueIndex("profile_post_media_asset_unique").on(table.profilePostId, table.mediaAssetId),
]);

/**
 * Server-side rolling-window source of truth for publishing and report limits.
 * Idempotency keys are scoped globally and contain no secret identity data.
 */
export const identityActionEvents = mysqlTable("identity_action_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  visitorSessionId: int("visitorSessionId").references(() => visitorSessions.id),
  actionType: mysqlEnum("actionType", ["main_ad", "profile_post", "report"]).notNull(),
  contentPublicId: varchar("contentPublicId", { length: 32 }),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("identity_action_idempotency_unique").on(table.idempotencyKey),
  index("identity_action_user_window_idx").on(table.userId, table.actionType, table.createdAt),
  index("identity_action_visitor_window_idx").on(
    table.visitorSessionId,
    table.actionType,
    table.createdAt,
  ),
]);

export const profileFollows = mysqlTable("profile_follows", {
  id: int("id").autoincrement().primaryKey(),
  advertiserProfileId: int("advertiserProfileId").notNull().references(() => advertiserProfiles.id),
  userId: int("userId").references(() => users.id),
  visitorSessionId: int("visitorSessionId").references(() => visitorSessions.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("profile_follow_user_unique").on(table.advertiserProfileId, table.userId),
  uniqueIndex("profile_follow_visitor_unique").on(table.advertiserProfileId, table.visitorSessionId),
]);

/** A derived share copy; the original media asset is never modified. */
export const shareMediaVariants = mysqlTable("share_media_variants", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  adId: int("adId").notNull().references(() => ads.id),
  sourceMediaAssetId: int("sourceMediaAssetId").notNull().references(() => mediaAssets.id),
  requestedByUserId: int("requestedByUserId").references(() => users.id),
  requestedByVisitorSessionId: int("requestedByVisitorSessionId").references(() => visitorSessions.id),
  status: mysqlEnum("status", ["processing", "ready", "failed"]).default("processing").notNull(),
  watermarkText: varchar("watermarkText", { length: 160 }).notNull(),
  storageKey: varchar("storageKey", { length: 768 }),
  url: varchar("url", { length: 1024 }),
  mimeType: varchar("mimeType", { length: 120 }),
  bytes: int("bytes"),
  failureReason: varchar("failureReason", { length: 240 }),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("share_media_variants_publicId_unique").on(table.publicId),
  uniqueIndex("share_media_variants_idempotency_unique").on(table.idempotencyKey),
  index("share_media_variants_expiry_idx").on(table.status, table.expiresAt),
]);

export type AdvertiserProfile = typeof advertiserProfiles.$inferSelect;
export type ProfilePost = typeof profilePosts.$inferSelect;
export type IdentityActionEvent = typeof identityActionEvents.$inferSelect;
export type ShareMediaVariant = typeof shareMediaVariants.$inferSelect;

