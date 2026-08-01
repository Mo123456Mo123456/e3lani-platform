import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar, tinyint } from "drizzle-orm/mysql-core";
import { users } from "./accounts";
import { cities } from "./catalog";
import { ads } from "./content";

export const pricingVersions = mysqlTable("pricing_versions", {
  id: int("id").autoincrement().primaryKey(),
  version: int("version").notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  basePriceHalalas: int("basePriceHalalas").default(5900).notNull(),
  vatBasisPoints: int("vatBasisPoints").default(1500).notNull(),
  isActive: tinyint("isActive").default(0).notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  createdBy: int("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("pricing_versions_version_unique").on(table.version),
]);

export const pricingRules = mysqlTable("pricing_rules", {
  id: int("id").autoincrement().primaryKey(),
  pricingVersionId: int("pricingVersionId").notNull().references(() => pricingVersions.id),
  code: varchar("code", { length: 64 }).notNull(),
  labelAr: varchar("labelAr", { length: 120 }).notNull(),
  labelEn: varchar("labelEn", { length: 120 }).notNull(),
  priceHalalas: int("priceHalalas").notNull(),
  durationDays: int("durationDays"),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("pricing_rules_version_code_unique").on(table.pricingVersionId, table.code),
]);

export const promotions = mysqlTable("promotions", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["highlight", "top_category", "city_targeting"]).notNull(),
  labelAr: varchar("labelAr", { length: 120 }).notNull(),
  labelEn: varchar("labelEn", { length: 120 }).notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("promotions_code_unique").on(table.code),
]);

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  userId: int("userId").notNull().references(() => users.id),
  adId: int("adId").references(() => ads.id),
  pricingVersionId: int("pricingVersionId").notNull().references(() => pricingVersions.id),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  channel: mysqlEnum("channel", ["web", "apple_iap", "google_play"]).notNull(),
  status: mysqlEnum("status", ["draft", "pending", "paid", "failed", "cancelled", "refunded", "partially_refunded"]).default("draft").notNull(),
  subtotalHalalas: int("subtotalHalalas").notNull(),
  vatHalalas: int("vatHalalas").notNull(),
  discountHalalas: int("discountHalalas").default(0).notNull(),
  totalHalalas: int("totalHalalas").notNull(),
  platformFeeHalalas: int("platformFeeHalalas").default(0).notNull(),
  providerFeeHalalas: int("providerFeeHalalas").default(0).notNull(),
  netRevenueHalalas: int("netRevenueHalalas").notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  priceSnapshot: json("priceSnapshot").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("orders_publicId_unique").on(table.publicId),
  uniqueIndex("orders_idempotencyKey_unique").on(table.idempotencyKey),
  index("orders_user_status_idx").on(table.userId, table.status),
]);

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  itemType: mysqlEnum("itemType", ["base_ad", "highlight_3", "highlight_7", "top_category", "city_targeting", "extension_15", "republish"]).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPriceHalalas: int("unitPriceHalalas").notNull(),
  totalHalalas: int("totalHalalas").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  provider: varchar("provider", { length: 64 }).notNull(),
  providerReference: varchar("providerReference", { length: 255 }),
  status: mysqlEnum("status", ["created", "pending", "authorized", "captured", "failed", "cancelled", "refunded", "partially_refunded"]).default("created").notNull(),
  amountHalalas: int("amountHalalas").notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  verifiedServerSide: tinyint("verifiedServerSide").default(0).notNull(),
  rawReceiptHash: varchar("rawReceiptHash", { length: 128 }),
  lastErrorCode: varchar("lastErrorCode", { length: 120 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("payments_providerReference_unique").on(table.providerReference),
]);

export const paymentAttempts = mysqlTable("payment_attempts", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: int("paymentId").notNull().references(() => payments.id),
  attemptNumber: int("attemptNumber").notNull(),
  status: varchar("status", { length: 64 }).notNull(),
  providerEventId: varchar("providerEventId", { length: 255 }),
  requestId: varchar("requestId", { length: 128 }),
  responseCode: varchar("responseCode", { length: 120 }),
  responseMetadata: json("responseMetadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("payment_attempts_providerEventId_unique").on(table.providerEventId),
]);

export const refunds = mysqlTable("refunds", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  paymentId: int("paymentId").notNull().references(() => payments.id),
  amountHalalas: int("amountHalalas").notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["requested", "processing", "completed", "failed"]).default("requested").notNull(),
  providerReference: varchar("providerReference", { length: 255 }),
  requestedBy: int("requestedBy").notNull().references(() => users.id),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  orderId: int("orderId").notNull().references(() => orders.id),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull(),
  sellerName: varchar("sellerName", { length: 180 }).notNull(),
  sellerVatNumber: varchar("sellerVatNumber", { length: 32 }),
  buyerSnapshot: json("buyerSnapshot"),
  totalHalalas: int("totalHalalas").notNull(),
  vatHalalas: int("vatHalalas").notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  issuedAt: timestamp("issuedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("invoices_publicId_unique").on(table.publicId),
  uniqueIndex("invoices_orderId_unique").on(table.orderId),
  uniqueIndex("invoices_invoiceNumber_unique").on(table.invoiceNumber),
]);

export const adPromotions = mysqlTable("ad_promotions", {
  id: int("id").autoincrement().primaryKey(),
  adId: int("adId").notNull().references(() => ads.id),
  promotionId: int("promotionId").notNull().references(() => promotions.id),
  orderItemId: int("orderItemId").notNull().references(() => orderItems.id),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  cityId: int("cityId").references(() => cities.id),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Provider-agnostic payment intent; never created for free (not_required) publishes. */
export const paymentIntents = mysqlTable("payment_intents", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  userId: int("userId").notNull().references(() => users.id),
  adId: int("adId").references(() => ads.id),
  provider: varchar("provider", { length: 64 }).notNull(),
  environment: mysqlEnum("environment", ["sandbox", "production"]).default("sandbox").notNull(),
  amount: int("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: mysqlEnum("status", [
    "not_required",
    "pending",
    "processing",
    "paid",
    "failed",
    "cancelled",
    "refunded",
    "partially_refunded",
  ]).default("pending").notNull(),
  externalId: varchar("externalId", { length: 255 }),
  clientSecret: varchar("clientSecret", { length: 255 }),
  webhookVerified: tinyint("webhookVerified").default(0).notNull(),
  metadata: json("metadata"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("payment_intents_publicId_unique").on(table.publicId),
  index("payment_intents_ad_idx").on(table.adId, table.status),
]);

export type Order = typeof orders.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentIntent = typeof paymentIntents.$inferSelect;
