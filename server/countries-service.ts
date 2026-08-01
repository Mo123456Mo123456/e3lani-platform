import { and, asc, eq, like, or, sql } from "drizzle-orm";

import { cities, countries, regions } from "../drizzle/schema";
import { writeAuditLog } from "./audit-service";
import { getDb, requireDatabase } from "./db";

export async function listCountriesPage(input?: {
  offset?: number;
  limit?: number;
  includeInactive?: boolean;
  q?: string;
}) {
  const database = await getDb();
  if (!database) {
    return { items: [], offset: 0, limit: input?.limit ?? 40, total: 0, hasMore: false };
  }
  const db = requireDatabase(database);
  const offset = Math.max(input?.offset ?? 0, 0);
  const limit = Math.min(Math.max(input?.limit ?? 40, 1), 100);
  const conditions = [];
  if (!input?.includeInactive) conditions.push(eq(countries.isActive, 1));
  if (input?.q?.trim()) {
    const q = `%${input.q.trim()}%`;
    conditions.push(
      or(like(countries.nameAr, q), like(countries.nameEn, q), like(countries.code, q))!,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db
      .select({
        code: countries.code,
        nameAr: countries.nameAr,
        nameEn: countries.nameEn,
        flag: countries.flagEmoji,
        dialCode: countries.dialCode,
        currency: countries.currency,
        defaultLocale: countries.defaultLocale,
        timezone: countries.timezone,
        isActive: countries.isActive,
        sortOrder: countries.sortOrder,
      })
      .from(countries)
      .where(where)
      .orderBy(asc(countries.sortOrder), asc(countries.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(countries)
      .where(where),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  return {
    items: rows.map((row) => ({ ...row, isActive: row.isActive === 1 })),
    offset,
    limit,
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function setCountryActive(input: {
  actorId: number;
  code: string;
  isActive: boolean;
}) {
  const db = requireDatabase(await getDb());
  const code = input.code.toUpperCase();
  const rows = await db.select().from(countries).where(eq(countries.code, code)).limit(1);
  if (!rows[0]) throw new Error("COUNTRY_NOT_FOUND");
  await db.update(countries).set({ isActive: input.isActive ? 1 : 0 }).where(eq(countries.id, rows[0].id));
  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "admin",
    action: input.isActive ? "country.activate" : "country.deactivate",
    entityType: "country",
    entityId: code,
    beforeState: { isActive: rows[0].isActive === 1 },
    afterState: { isActive: input.isActive },
  }).catch(() => undefined);
  return { ok: true as const };
}

export async function listCitiesForCountry(input: {
  countryCode: string;
  includeOther?: boolean;
}) {
  const db = requireDatabase(await getDb());
  const code = input.countryCode.toUpperCase();
  const countryRows = await db
    .select({ id: countries.id, code: countries.code })
    .from(countries)
    .where(eq(countries.code, code))
    .limit(1);
  const country = countryRows[0];

  if (country) {
    await ensureOtherCityForCountry(country.id, code);
  }

  const cityFilter = country
    ? and(
        eq(cities.isActive, 1),
        or(
          eq(cities.countryId, country.id),
          eq(cities.code, `other-${code.toLowerCase()}`),
          eq(cities.code, "other"),
        ),
      )
    : eq(cities.isActive, 1);

  const rows = await db
    .select({
      code: cities.code,
      nameAr: cities.nameAr,
      nameEn: cities.nameEn,
      countryId: cities.countryId,
      countryCode: countries.code,
      latitudeE6: cities.latitudeE6,
      longitudeE6: cities.longitudeE6,
      sortOrder: cities.sortOrder,
    })
    .from(cities)
    .leftJoin(countries, eq(cities.countryId, countries.id))
    .where(cityFilter)
    .orderBy(asc(cities.sortOrder), asc(cities.id));

  const filtered = rows.filter((row) => {
    if (!country) return true;
    if (row.countryId === country.id) return true;
    if (row.code === `other-${code.toLowerCase()}` || row.code === "other") return Boolean(input.includeOther ?? true);
    return false;
  });

  return filtered.map((row) => ({
    code: row.code,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    countryCode: row.countryCode ?? code,
    latitudeE6: row.latitudeE6,
    longitudeE6: row.longitudeE6,
    isOther: row.code === "other" || row.code.startsWith("other-"),
  }));
}

export async function ensureOtherCityForCountry(countryId: number, countryCode: string) {
  const db = requireDatabase(await getDb());
  const code = `other-${countryCode.toLowerCase()}`;
  const existing = await db.select({ id: cities.id }).from(cities).where(eq(cities.code, code)).limit(1);
  if (existing[0]) {
    await db.update(cities).set({ countryId, isActive: 1 }).where(eq(cities.id, existing[0].id));
    return existing[0].id;
  }

  const region = await db
    .select({ id: regions.id })
    .from(regions)
    .where(eq(regions.isActive, 1))
    .orderBy(asc(regions.sortOrder))
    .limit(1);
  if (!region[0]) throw new Error("REGION_NOT_FOUND");

  const inserted = await db.insert(cities).values({
    regionId: region[0].id,
    countryId,
    code,
    nameAr: "مدينة أخرى",
    nameEn: "Other city",
    isActive: 1,
    sortOrder: 9999,
  });
  return Number(inserted[0].insertId);
}
