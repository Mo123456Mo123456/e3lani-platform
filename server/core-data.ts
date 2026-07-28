import { randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import {
  adContacts,
  adEvents,
  adMedia,
  adMetricsDaily,
  adRevisions,
  ads,
  businessProfiles,
  categories,
  cities,
  favorites,
  mediaAssets,
  moderationCases,
  reports,
  userProfiles,
  users,
} from "../drizzle/schema";
import { validateSaudiWhatsapp } from "../shared/contact-validation";
import {
  initialAdStatusForMode,
  requiresPaymentForPublishing,
  type FeedAccessMode,
} from "../shared/feed-access";
import { getDb } from "./db";
import { getPublicProductConfig } from "./product-config";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type AdRow = typeof ads.$inferSelect;
type EventType = typeof adEvents.$inferInsert.eventType;
type ContactType = typeof adContacts.$inferInsert.contactType;
type ReportReason = typeof reports.$inferInsert.reason;

export type CentralContactInput = {
  type: ContactType;
  value: string;
};

export type CreateCentralAdInput = {
  title: string;
  description?: string;
  categoryCode: string;
  cityCode: string;
  mediaAssetIds: number[];
  contacts: CentralContactInput[];
};

function requireDatabase(database: Awaited<ReturnType<typeof getDb>>): Database {
  if (!database) throw new Error("DATABASE_UNAVAILABLE");
  return database;
}

function publicId(prefix: "AD" | "RPT") {
  return `${prefix}${randomBytes(7).toString("hex").toUpperCase()}`;
}

function dateIso(value: Date | null | undefined) {
  return value?.toISOString();
}

function normalizeContact(input: CentralContactInput): CentralContactInput {
  const value = input.value.trim();
  if (!value) throw new Error("CONTACT_VALUE_REQUIRED");

  if (input.type === "whatsapp") {
    const validation = validateSaudiWhatsapp(value);
    if (!validation.valid) throw new Error("WHATSAPP_INVALID");
    return { type: input.type, value: validation.normalized };
  }

  if (input.type === "store" || input.type === "product") {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("CONTACT_URL_INVALID");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("CONTACT_URL_INVALID");
    }
    return { type: input.type, value: parsed.toString() };
  }

  if (!/^\+?[0-9][0-9\s()-]{6,24}$/.test(value)) {
    throw new Error("PHONE_INVALID");
  }
  return { type: input.type, value };
}

async function resolveCatalog(database: Database, categoryCode: string, cityCode: string) {
  const [categoryRows, cityRows] = await Promise.all([
    database
      .select({ id: categories.id, code: categories.slug })
      .from(categories)
      .where(and(eq(categories.slug, categoryCode), eq(categories.isActive, 1)))
      .limit(1),
    database
      .select({ id: cities.id, code: cities.code })
      .from(cities)
      .where(and(eq(cities.code, cityCode), eq(cities.isActive, 1)))
      .limit(1),
  ]);

  const category = categoryRows[0];
  const city = cityRows[0];
  if (!category) throw new Error("CATEGORY_NOT_FOUND");
  if (!city) throw new Error("CITY_NOT_FOUND");
  return { category, city };
}

async function validateOwnedMedia(database: Database, ownerId: number, mediaAssetIds: number[]) {
  const uniqueIds = [...new Set(mediaAssetIds)];
  if (!uniqueIds.length) throw new Error("MEDIA_REQUIRED");
  if (uniqueIds.length > 10) throw new Error("MEDIA_LIMIT_EXCEEDED");

  const rows = await database
    .select({
      id: mediaAssets.id,
      mediaType: mediaAssets.mediaType,
      processingStatus: mediaAssets.processingStatus,
    })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerId, ownerId), inArray(mediaAssets.id, uniqueIds)));

  if (rows.length !== uniqueIds.length) throw new Error("MEDIA_NOT_OWNED");
  if (rows.some((row) => row.processingStatus !== "ready")) throw new Error("MEDIA_NOT_READY");
  const videos = rows.filter((row) => row.mediaType === "video").length;
  if (videos > 1 || (videos === 1 && rows.length > 1)) throw new Error("MEDIA_MIX_INVALID");
  return uniqueIds;
}

async function hydrateAd(database: Database, ad: AdRow) {
  const revisionId = ad.currentRevisionId ?? ad.pendingRevisionId;
  if (!revisionId) return null;

  const [revisionRows, mediaRows, contactRows, catalogRows, ownerRows, metricRows] = await Promise.all([
    database
      .select({
        id: adRevisions.id,
        version: adRevisions.version,
        title: adRevisions.title,
        description: adRevisions.description,
        reviewStatus: adRevisions.reviewStatus,
      })
      .from(adRevisions)
      .where(eq(adRevisions.id, revisionId))
      .limit(1),
    database
      .select({
        id: adMedia.id,
        mediaAssetId: mediaAssets.id,
        kind: mediaAssets.mediaType,
        uri: mediaAssets.originalUrl,
        processingStatus: mediaAssets.processingStatus,
        variants: mediaAssets.variants,
        sortOrder: adMedia.sortOrder,
      })
      .from(adMedia)
      .innerJoin(mediaAssets, eq(adMedia.mediaAssetId, mediaAssets.id))
      .where(eq(adMedia.revisionId, revisionId))
      .orderBy(asc(adMedia.sortOrder)),
    database
      .select({
        type: adContacts.contactType,
        value: adContacts.contactValue,
        verified: adContacts.isVerified,
        sortOrder: adContacts.sortOrder,
      })
      .from(adContacts)
      .where(eq(adContacts.revisionId, revisionId))
      .orderBy(asc(adContacts.sortOrder)),
    database
      .select({
        categoryCode: categories.slug,
        categoryAr: categories.nameAr,
        categoryEn: categories.nameEn,
        cityCode: cities.code,
        cityAr: cities.nameAr,
        cityEn: cities.nameEn,
      })
      .from(categories)
      .innerJoin(cities, eq(cities.id, ad.cityId))
      .where(eq(categories.id, ad.categoryId))
      .limit(1),
    database
      .select({
        userName: users.name,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        businessName: businessProfiles.displayName,
        businessSlug: businessProfiles.slug,
        businessLogoUrl: businessProfiles.logoUrl,
        businessVerified: businessProfiles.verificationStatus,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
      .where(eq(users.id, ad.ownerId))
      .limit(1),
    database
      .select({
        impressions: sql<number>`coalesce(sum(${adMetricsDaily.impressions}), 0)`,
        views: sql<number>`coalesce(sum(${adMetricsDaily.views}), 0)`,
        saves: sql<number>`coalesce(sum(${adMetricsDaily.saves}), 0)`,
        shares: sql<number>`coalesce(sum(${adMetricsDaily.shares}), 0)`,
        contacts: sql<number>`coalesce(sum(${adMetricsDaily.contactIntents}), 0)`,
      })
      .from(adMetricsDaily)
      .where(eq(adMetricsDaily.adId, ad.id)),
  ]);

  const revision = revisionRows[0];
  const catalog = catalogRows[0];
  if (!revision || !catalog) return null;
  const owner = ownerRows[0];
  const metrics = metricRows[0];

  return {
    id: ad.publicId,
    databaseId: ad.id,
    ownerId: String(ad.ownerId),
    advertiser: {
      name: owner?.businessName ?? owner?.displayName ?? owner?.userName ?? "معلن",
      slug: owner?.businessSlug ?? null,
      avatarUrl: owner?.businessLogoUrl ?? owner?.avatarUrl ?? null,
      verified: owner?.businessVerified === "verified",
    },
    title: revision.title,
    description: revision.description,
    categoryId: catalog.categoryCode,
    category: { ar: catalog.categoryAr, en: catalog.categoryEn },
    cityId: catalog.cityCode,
    city: { ar: catalog.cityAr, en: catalog.cityEn },
    media: mediaRows.map((row) => ({
      id: `media-${row.mediaAssetId}`,
      mediaAssetId: row.mediaAssetId,
      kind: row.kind,
      uri: row.uri,
      processingStatus: row.processingStatus,
      variants: row.variants,
    })),
    contacts: contactRows.map((row) => ({
      type: row.type,
      value: row.value,
      verified: row.verified === 1,
    })),
    status: ad.adStatus,
    paymentStatus: ad.paymentStatus,
    moderationStatus: ad.moderationStatus,
    reviewStatus: revision.reviewStatus,
    revision: revision.version,
    createdAt: ad.createdAt.toISOString(),
    activatedAt: dateIso(ad.activatedAt),
    expiresAt: dateIso(ad.expiresAt),
    lastRepublishedAt: dateIso(ad.lastRepublishedAt),
    metrics: {
      impressions: Number(metrics?.impressions ?? 0),
      views: Number(metrics?.views ?? 0),
      saves: Number(metrics?.saves ?? 0),
      shares: Number(metrics?.shares ?? 0),
      contacts: Number(metrics?.contacts ?? 0),
    },
  };
}

async function hydrateMany(database: Database, rows: AdRow[]) {
  const hydrated = await Promise.all(rows.map((row) => hydrateAd(database, row)));
  return hydrated.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function createCentralAd(ownerId: number, input: CreateCentralAdInput) {
  const database = requireDatabase(await getDb());
  const title = input.title.trim();
  if (title.length < 4 || title.length > 120) throw new Error("TITLE_INVALID");
  const description = input.description?.trim() ?? "";
  if (description.length > 4000) throw new Error("DESCRIPTION_TOO_LONG");
  if (!input.contacts.length) throw new Error("CONTACT_REQUIRED");
  if (input.contacts.length > 4) throw new Error("CONTACT_LIMIT_EXCEEDED");

  const contacts = input.contacts.map(normalizeContact);
  const [catalog, ownedMediaIds, productConfig] = await Promise.all([
    resolveCatalog(database, input.categoryCode, input.cityCode),
    validateOwnedMedia(database, ownerId, input.mediaAssetIds),
    getPublicProductConfig(),
  ]);
  const mode = productConfig.feedAccessMode as FeedAccessMode;
  const paymentRequired = requiresPaymentForPublishing(mode);
  const now = new Date();
  const adStatus = initialAdStatusForMode(mode);

  const created = await database.transaction(async (tx) => {
    const [insertedAd] = await tx
      .insert(ads)
      .values({
        publicId: publicId("AD"),
        ownerId,
        categoryId: catalog.category.id,
        cityId: catalog.city.id,
        adStatus,
        paymentStatus: paymentRequired ? "unpaid" : "not_required",
        mediaStatus: "ready",
        moderationStatus: paymentRequired ? "not_submitted" : "queued",
      })
      .$returningId();
    if (!insertedAd?.id) throw new Error("AD_CREATE_FAILED");

    const [insertedRevision] = await tx
      .insert(adRevisions)
      .values({
        adId: insertedAd.id,
        version: 1,
        title,
        description,
        reviewStatus: paymentRequired ? "draft" : "queued",
        submittedAt: paymentRequired ? null : now,
        createdBy: ownerId,
      })
      .$returningId();
    if (!insertedRevision?.id) throw new Error("AD_REVISION_CREATE_FAILED");

    await tx.insert(adMedia).values(
      ownedMediaIds.map((mediaAssetId, index) => ({
        revisionId: insertedRevision.id,
        mediaAssetId,
        sortOrder: index,
      })),
    );
    await tx.insert(adContacts).values(
      contacts.map((contact, index) => ({
        revisionId: insertedRevision.id,
        contactType: contact.type,
        contactValue: contact.value,
        isVerified: contact.type === "whatsapp" || contact.type === "phone" ? 0 : 1,
        sortOrder: index,
      })),
    );
    await tx
      .update(ads)
      .set({ pendingRevisionId: insertedRevision.id })
      .where(eq(ads.id, insertedAd.id));

    if (!paymentRequired) {
      await tx.insert(moderationCases).values({
        adId: insertedAd.id,
        revisionId: insertedRevision.id,
        status: "queued",
      });
    }

    await tx
      .update(users)
      .set({ accountType: "advertiser" })
      .where(and(eq(users.id, ownerId), eq(users.accountType, "viewer")));

    return insertedAd.id;
  });

  const rows = await database.select().from(ads).where(eq(ads.id, created)).limit(1);
  const hydrated = rows[0] ? await hydrateAd(database, rows[0]) : null;
  if (!hydrated) throw new Error("AD_HYDRATE_FAILED");
  return hydrated;
}

export async function listFeed(input: {
  cityCode?: string;
  categoryCode?: string;
  limit: number;
}) {
  const database = requireDatabase(await getDb());
  const conditions = [eq(ads.adStatus, "active"), isNull(ads.deletedAt)];

  if (input.cityCode) {
    const rows = await database
      .select({ id: cities.id })
      .from(cities)
      .where(eq(cities.code, input.cityCode))
      .limit(1);
    if (!rows[0]) return [];
    conditions.push(eq(ads.cityId, rows[0].id));
  }
  if (input.categoryCode) {
    const rows = await database
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, input.categoryCode))
      .limit(1);
    if (!rows[0]) return [];
    conditions.push(eq(ads.categoryId, rows[0].id));
  }

  conditions.push(or(isNull(ads.expiresAt), gt(ads.expiresAt, new Date()))!);
  const rows = await database
    .select()
    .from(ads)
    .where(and(...conditions))
    .orderBy(desc(ads.activatedAt), desc(ads.createdAt))
    .limit(input.limit);
  return hydrateMany(database, rows);
}

export async function listMyAds(ownerId: number, limit: number) {
  const database = requireDatabase(await getDb());
  const rows = await database
    .select()
    .from(ads)
    .where(and(eq(ads.ownerId, ownerId), isNull(ads.deletedAt)))
    .orderBy(desc(ads.createdAt))
    .limit(limit);
  return hydrateMany(database, rows);
}

export async function getAdByPublicId(publicAdId: string, requesterId?: number) {
  const database = requireDatabase(await getDb());
  const rows = await database
    .select()
    .from(ads)
    .where(and(eq(ads.publicId, publicAdId), isNull(ads.deletedAt)))
    .limit(1);
  const ad = rows[0];
  if (!ad) return null;
  if (ad.adStatus !== "active" && ad.ownerId !== requesterId) return null;
  return hydrateAd(database, ad);
}

export async function updateCentralProfile(
  userId: number,
  input: { name?: string; phone?: string; cityCode?: string; displayName?: string; bio?: string },
) {
  const database = requireDatabase(await getDb());
  let cityId: number | undefined;
  if (input.cityCode) {
    const rows = await database
      .select({ id: cities.id })
      .from(cities)
      .where(and(eq(cities.code, input.cityCode), eq(cities.isActive, 1)))
      .limit(1);
    if (!rows[0]) throw new Error("CITY_NOT_FOUND");
    cityId = rows[0].id;
  }

  await database.transaction(async (tx) => {
    const userPatch: Partial<typeof users.$inferInsert> = {};
    if (input.name !== undefined) userPatch.name = input.name.trim() || null;
    if (input.phone !== undefined) userPatch.phone = input.phone.trim() || null;
    if (cityId !== undefined) userPatch.cityId = cityId;
    if (Object.keys(userPatch).length) {
      await tx.update(users).set(userPatch).where(eq(users.id, userId));
    }

    if (input.displayName !== undefined || input.bio !== undefined) {
      await tx
        .insert(userProfiles)
        .values({
          userId,
          displayName: input.displayName?.trim() || null,
          bio: input.bio?.trim() || null,
        })
        .onDuplicateKeyUpdate({
          set: {
            displayName: input.displayName?.trim() || null,
            bio: input.bio?.trim() || null,
          },
        });
    }
  });

  const rows = await database
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      role: users.role,
      accountType: users.accountType,
      status: users.status,
      preferredLanguage: users.preferredLanguage,
      cityCode: cities.code,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      bio: userProfiles.bio,
    })
    .from(users)
    .leftJoin(cities, eq(cities.id, users.cityId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function toggleFavorite(userId: number, publicAdId: string) {
  const database = requireDatabase(await getDb());
  const adRows = await database
    .select({ id: ads.id })
    .from(ads)
    .where(and(eq(ads.publicId, publicAdId), eq(ads.adStatus, "active"), isNull(ads.deletedAt)))
    .limit(1);
  const ad = adRows[0];
  if (!ad) throw new Error("AD_NOT_FOUND");

  const existing = await database
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.adId, ad.id)))
    .limit(1);
  if (existing[0]) {
    await database.delete(favorites).where(eq(favorites.id, existing[0].id));
    return { saved: false };
  }
  await database.insert(favorites).values({ userId, adId: ad.id });
  await recordCentralEvent({
    adId: ad.id,
    userId,
    eventType: "save",
    idempotencyKey: publicId("RPT"),
  });
  return { saved: true };
}

export async function listFavorites(userId: number, limit: number) {
  const database = requireDatabase(await getDb());
  const rows = await database
    .select({ ad: ads })
    .from(favorites)
    .innerJoin(ads, eq(favorites.adId, ads.id))
    .where(and(eq(favorites.userId, userId), eq(ads.adStatus, "active"), isNull(ads.deletedAt)))
    .orderBy(desc(favorites.createdAt))
    .limit(limit);
  return hydrateMany(database, rows.map((row) => row.ad));
}

export async function createReport(
  reporterId: number,
  input: { publicAdId: string; reason: ReportReason; details?: string },
) {
  const database = requireDatabase(await getDb());
  const adRows = await database
    .select({ id: ads.id })
    .from(ads)
    .where(and(eq(ads.publicId, input.publicAdId), isNull(ads.deletedAt)))
    .limit(1);
  const ad = adRows[0];
  if (!ad) throw new Error("AD_NOT_FOUND");

  const existing = await database
    .select({ publicId: reports.publicId, status: reports.status })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, reporterId),
        eq(reports.adId, ad.id),
        or(eq(reports.status, "open"), eq(reports.status, "assigned")),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const reportId = publicId("RPT");
  await database.insert(reports).values({
    publicId: reportId,
    reporterId,
    adId: ad.id,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
  await recordCentralEvent({
    adId: ad.id,
    userId: reporterId,
    eventType: "report",
    idempotencyKey: reportId,
  });
  return { publicId: reportId, status: "open" as const };
}

function metricDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function metricIncrement(eventType: EventType) {
  switch (eventType) {
    case "impression":
      return { impressions: sql`${adMetricsDaily.impressions} + 1` };
    case "view":
      return { views: sql`${adMetricsDaily.views} + 1` };
    case "save":
      return { saves: sql`${adMetricsDaily.saves} + 1` };
    case "share":
      return { shares: sql`${adMetricsDaily.shares} + 1` };
    case "store_click":
    case "product_click":
    case "whatsapp_click":
    case "phone_click":
      return { contactIntents: sql`${adMetricsDaily.contactIntents} + 1` };
    default:
      return {};
  }
}

export async function recordCentralEvent(input: {
  adId: number;
  userId?: number;
  anonymousId?: string;
  eventType: EventType;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}) {
  const database = requireDatabase(await getDb());
  const dedupeKey = `${input.userId ?? input.anonymousId ?? "anonymous"}:${input.adId}:${input.eventType}:${input.idempotencyKey}`.slice(0, 160);
  const now = new Date();

  try {
    await database.insert(adEvents).values({
      adId: input.adId,
      userId: input.userId ?? null,
      anonymousId: input.anonymousId?.slice(0, 128) ?? null,
      eventType: input.eventType,
      dedupeKey,
      metadata: input.metadata ?? null,
      occurredAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ad_events_dedupeKey_unique") || message.includes("Duplicate entry")) {
      return { recorded: false, duplicate: true } as const;
    }
    throw error;
  }

  const increment = metricIncrement(input.eventType);
  if (Object.keys(increment).length) {
    await database
      .insert(adMetricsDaily)
      .values({
        adId: input.adId,
        metricDate: metricDate(now),
        impressions: input.eventType === "impression" ? 1 : 0,
        views: input.eventType === "view" ? 1 : 0,
        saves: input.eventType === "save" ? 1 : 0,
        shares: input.eventType === "share" ? 1 : 0,
        contactIntents: ["store_click", "product_click", "whatsapp_click", "phone_click"].includes(input.eventType) ? 1 : 0,
      })
      .onDuplicateKeyUpdate({ set: increment });
  }
  return { recorded: true, duplicate: false } as const;
}

export async function recordEventByPublicId(input: {
  publicAdId: string;
  userId?: number;
  anonymousId?: string;
  eventType: EventType;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}) {
  const database = requireDatabase(await getDb());
  const rows = await database
    .select({ id: ads.id })
    .from(ads)
    .where(and(eq(ads.publicId, input.publicAdId), eq(ads.adStatus, "active"), isNull(ads.deletedAt)))
    .limit(1);
  if (!rows[0]) throw new Error("AD_NOT_FOUND");
  return recordCentralEvent({ ...input, adId: rows[0].id });
}
