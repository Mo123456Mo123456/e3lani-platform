import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar, tinyint } from "drizzle-orm/mysql-core";
import { users } from "./accounts";
import { adRevisions, ads } from "./content";

export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 120 }).notNull(),
  value: json("value").notNull(),
  isPublic: tinyint("isPublic").default(0).notNull(),
  updatedBy: int("updatedBy").references(() => users.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("app_settings_settingKey_unique").on(table.settingKey),
]);

export const moderationCases = mysqlTable("moderation_cases", {
  id: int("id").autoincrement().primaryKey(),
  adId: int("adId").notNull().references(() => ads.id),
  revisionId: int("revisionId").notNull().references(() => adRevisions.id),
  status: mysqlEnum("status", ["queued", "in_review", "approved", "changes_requested", "rejected", "appealed"]).default("queued").notNull(),
  riskScore: int("riskScore").default(0).notNull(),
  automatedSignals: json("automatedSignals"),
  assignedTo: int("assignedTo").references(() => users.id),
  decisionReason: text("decisionReason"),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const moderationNotes = mysqlTable("moderation_notes", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().references(() => moderationCases.id),
  authorId: int("authorId").notNull().references(() => users.id),
  note: text("note").notNull(),
  isInternal: tinyint("isInternal").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const appeals = mysqlTable("appeals", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().references(() => moderationCases.id),
  userId: int("userId").notNull().references(() => users.id),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["open", "accepted", "rejected"]).default("open").notNull(),
  decidedBy: int("decidedBy").references(() => users.id),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId").references(() => users.id),
  actorRole: varchar("actorRole", { length: 64 }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  reason: text("reason"),
  beforeState: json("beforeState"),
  afterState: json("afterState"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 768 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("audit_entity_idx").on(table.entityType, table.entityId, table.createdAt),
]);

export const blocks = mysqlTable("blocks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  blockedUserId: int("blockedUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("block_user_target_uq").on(table.userId, table.blockedUserId),
]);

export const consentRecords = mysqlTable("consent_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  anonymousId: varchar("anonymousId", { length: 128 }),
  policyType: mysqlEnum("policyType", ["terms", "privacy", "content", "refund"]).notNull(),
  policyVersion: varchar("policyVersion", { length: 32 }).notNull(),
  accepted: tinyint("accepted").notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  adId: int("adId").notNull().references(() => ads.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("favorite_user_ad_uq").on(table.userId, table.adId),
]);

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  reporterId: int("reporterId").references(() => users.id),
  adId: int("adId").notNull().references(() => ads.id),
  reason: mysqlEnum("reason", ["spam", "fraud", "prohibited", "misleading", "copyright", "other"]).notNull(),
  details: text("details"),
  status: mysqlEnum("status", ["open", "assigned", "resolved", "dismissed"]).default("open").notNull(),
  assignedTo: int("assignedTo").references(() => users.id),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("reports_publicId_unique").on(table.publicId),
]);

export const reportActions = mysqlTable("report_actions", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull().references(() => reports.id),
  actorId: int("actorId").notNull().references(() => users.id),
  action: mysqlEnum("action", ["assign", "dismiss", "remove_ad", "suspend_user", "restore_ad", "resolve"]).notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const securityEvents = mysqlTable("security_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  eventType: varchar("eventType", { length: 120 }).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 768 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  userId: int("userId").notNull().references(() => users.id),
  subject: varchar("subject", { length: 180 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  assignedTo: int("assignedTo").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("support_tickets_publicId_unique").on(table.publicId),
]);

export const userDataRequests = mysqlTable("user_data_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  requestType: mysqlEnum("requestType", ["export", "delete", "correct"]).notNull(),
  status: mysqlEnum("status", ["requested", "processing", "completed", "rejected"]).default("requested").notNull(),
  reason: text("reason"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
