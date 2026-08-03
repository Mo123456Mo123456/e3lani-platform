import { index, int, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar, tinyint } from "drizzle-orm/mysql-core";

export const regions = mysqlTable("regions", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  nameAr: varchar("nameAr", { length: 120 }).notNull(),
  nameEn: varchar("nameEn", { length: 120 }).notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("regions_code_unique").on(table.code),
]);

export const cities = mysqlTable("cities", {
  id: int("id").autoincrement().primaryKey(),
  regionId: int("regionId").notNull().references(() => regions.id),
  /** FK enforced in SQL migration 0009; kept untyped here to avoid schema cycles. */
  countryId: int("countryId"),
  code: varchar("code", { length: 32 }).notNull(),
  nameAr: varchar("nameAr", { length: 120 }).notNull(),
  nameEn: varchar("nameEn", { length: 120 }).notNull(),
  latitudeE6: int("latitudeE6"),
  longitudeE6: int("longitudeE6"),
  isActive: tinyint("isActive").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("cities_code_unique").on(table.code),
  index("cities_region_idx").on(table.regionId),
  index("cities_country_idx").on(table.countryId),
]);

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parentId"),
  slug: varchar("slug", { length: 120 }).notNull(),
  nameAr: varchar("nameAr", { length: 120 }).notNull(),
  nameEn: varchar("nameEn", { length: 120 }).notNull(),
  icon: varchar("icon", { length: 64 }).notNull(),
  reviewPolicy: mysqlEnum("reviewPolicy", ["standard", "strict", "restricted"]).default("standard").notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("categories_slug_unique").on(table.slug),
  index("categories_parent_idx").on(table.parentId),
]);

export type Region = typeof regions.$inferSelect;
export type City = typeof cities.$inferSelect;
export type Category = typeof categories.$inferSelect;
