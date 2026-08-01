import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar, tinyint } from "drizzle-orm/mysql-core";
import { users } from "./accounts";
import { ads } from "./content";

export const countries = mysqlTable("countries", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 2 }).notNull(),
  nameAr: varchar("nameAr", { length: 120 }).notNull(),
  nameEn: varchar("nameEn", { length: 120 }).notNull(),
  flagEmoji: varchar("flagEmoji", { length: 16 }).notNull(),
  dialCode: varchar("dialCode", { length: 8 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  defaultLocale: varchar("defaultLocale", { length: 8 }).default("ar").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Riyadh").notNull(),
  paymentProviders: json("paymentProviders").$type<string[]>().default([]).notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("countries_code_unique").on(table.code),
]);

/** Flexible admin-managed pricing rules (does not mutate historical ad snapshots). */
export const scopedPricingRules = mysqlTable("scoped_pricing_rules", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  scopeType: mysqlEnum("scopeType", [
    "global",
    "country",
    "category",
    "account_type",
    "user",
    "brand",
    "campaign",
  ]).notNull(),
  countryId: int("countryId").references(() => countries.id),
  categoryId: int("categoryId"),
  accountType: varchar("accountType", { length: 32 }),
  adType: varchar("adType", { length: 32 }),
  basePrice: int("basePrice").notNull(),
  discountPrice: int("discountPrice"),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  taxRate: int("taxRate").default(0).notNull(), // basis points
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  isActive: tinyint("isActive").default(1).notNull(),
  priority: int("priority").default(0).notNull(),
  createdBy: int("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("scoped_pricing_rules_publicId_unique").on(table.publicId),
  index("scoped_pricing_rules_active_idx").on(table.isActive, table.priority),
]);

export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull(),
  discountType: mysqlEnum("discountType", ["percent", "fixed"]).notNull(),
  discountValue: int("discountValue").notNull(),
  countryId: int("countryId").references(() => countries.id),
  usageLimit: int("usageLimit"),
  usageLimitPerUser: int("usageLimitPerUser"),
  startsAt: timestamp("startsAt"),
  expiresAt: timestamp("expiresAt"),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("coupons_code_unique").on(table.code),
]);

export const adPriceSnapshots = mysqlTable("ad_price_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  adId: int("adId").notNull().references(() => ads.id),
  basePrice: int("basePrice").notNull(),
  discount: int("discount").default(0).notNull(),
  tax: int("tax").default(0).notNull(),
  finalPrice: int("finalPrice").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  pricingRuleId: int("pricingRuleId").references(() => scopedPricingRules.id),
  freeReason: varchar("freeReason", { length: 120 }),
  offerOrCoupon: varchar("offerOrCoupon", { length: 160 }),
  paymentStatus: mysqlEnum("paymentStatus", [
    "not_required",
    "pending",
    "processing",
    "paid",
    "failed",
    "cancelled",
    "refunded",
    "partially_refunded",
  ]).default("not_required").notNull(),
  snapshotJson: json("snapshotJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("ad_price_snapshots_ad_idx").on(table.adId),
]);

export type Country = typeof countries.$inferSelect;
export type ScopedPricingRuleRow = typeof scopedPricingRules.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type AdPriceSnapshot = typeof adPriceSnapshots.$inferSelect;
