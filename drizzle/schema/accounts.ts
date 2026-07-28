import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar, tinyint } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "reviewer", "finance", "support", "admin", "owner"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  phone: varchar("phone", { length: 32 }),
  accountType: mysqlEnum("accountType", ["viewer", "advertiser", "brand"]).default("viewer").notNull(),
  status: mysqlEnum("status", ["active", "suspended", "deleted"]).default("active").notNull(),
  preferredLanguage: mysqlEnum("preferredLanguage", ["ar", "en"]).default("ar").notNull(),
  cityId: int("cityId"),
  deletedAt: timestamp("deletedAt"),
}, (table) => [
  uniqueIndex("users_openId_unique").on(table.openId),
]);

export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  displayName: varchar("displayName", { length: 120 }),
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("user_profiles_userId_unique").on(table.userId),
]);

export const businessProfiles = mysqlTable("business_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  slug: varchar("slug", { length: 120 }).notNull(),
  legalName: varchar("legalName", { length: 180 }),
  displayName: varchar("displayName", { length: 120 }).notNull(),
  logoUrl: varchar("logoUrl", { length: 1024 }),
  coverUrl: varchar("coverUrl", { length: 1024 }),
  websiteUrl: varchar("websiteUrl", { length: 1024 }),
  commercialRegistrationMasked: varchar("commercialRegistrationMasked", { length: 64 }),
  verificationStatus: mysqlEnum("verificationStatus", ["unverified", "pending", "verified", "rejected"]).default("unverified").notNull(),
  verificationNote: text("verificationNote"),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("business_profiles_userId_unique").on(table.userId),
  uniqueIndex("business_profiles_slug_unique").on(table.slug),
]);

export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  pushEnabled: tinyint("pushEnabled").default(1).notNull(),
  emailEnabled: tinyint("emailEnabled").default(1).notNull(),
  smsEnabled: tinyint("smsEnabled").default(0).notNull(),
  reviewUpdates: tinyint("reviewUpdates").default(1).notNull(),
  paymentUpdates: tinyint("paymentUpdates").default(1).notNull(),
  expiryReminders: tinyint("expiryReminders").default(1).notNull(),
  marketing: tinyint("marketing").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("notification_preferences_userId_unique").on(table.userId),
]);

export const authSessions = mysqlTable("auth_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  tokenId: varchar("tokenId", { length: 64 }).notNull(),
  clientType: mysqlEnum("clientType", ["web", "native"]).notNull(),
  userAgentHash: varchar("userAgentHash", { length: 64 }),
  ipHash: varchar("ipHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
}, (table) => [
  uniqueIndex("auth_sessions_tokenId_unique").on(table.tokenId),
  index("auth_sessions_user_active_idx").on(table.userId, table.revokedAt, table.expiresAt),
]);

export const authRateLimits = mysqlTable("auth_rate_limits", {
  id: int("id").autoincrement().primaryKey(),
  scope: varchar("scope", { length: 48 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull(),
  attempts: int("attempts").default(0).notNull(),
  windowStartedAt: timestamp("windowStartedAt").defaultNow().notNull(),
  blockedUntil: timestamp("blockedUntil"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("auth_rate_limits_scope_key_unique").on(table.scope, table.keyHash),
  index("auth_rate_limits_blocked_idx").on(table.blockedUntil),
]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  type: varchar("type", { length: 64 }).notNull(),
  titleAr: varchar("titleAr", { length: 180 }).notNull(),
  titleEn: varchar("titleEn", { length: 180 }).notNull(),
  bodyAr: text("bodyAr").notNull(),
  bodyEn: text("bodyEn").notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: varchar("entityId", { length: 64 }),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
