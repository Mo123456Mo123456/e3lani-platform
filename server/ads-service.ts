import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

import {
  adContacts,
  adEvents,
  adMedia,
  adMetricsDaily,
  adPriceSnapshots,
  adRevisions,
  ads,
  appeals,
  categories,
  cities,
  countries,
  favorites,
  mediaAssets,
  moderationCases,
  reports,
  scopedPricingRules,
  users,
} from "../drizzle/schema";
import { scanAdContent } from "../lib/moderation/ai-scan";
import { getDb, requireDatabase } from "./db";
import { resolveServerPublishQuote } from "./pricing-service";

function publicId(prefix: string, max = 24) {
  return `${prefix}${randomBytes(8).toString("hex")}`.slice(0, max);
}

export type FeedAdDto = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  categoryId: string;
  cityId: string;
  cityNameAr: string;
  cityNameEn: string;
  customCityName: string | null;
  countryCode: string;
  media: { id: string; kind: "image" | "video"; uri: string; mediaAssetId: number }[];
  contacts: { type: "store" | "product" | "whatsapp" | "phone"; value: string }[];
  status: string;
  revision: number;
  verified: boolean;
  featured: boolean;
  sponsored: boolean;
  createdAt: string;
  activatedAt?: string;
  expiresAt?: string;
  promotions: [];
  aiLabel?: "SAFE" | "NEEDS_REVIEW" | "BLOCKED";
  paymentStatus: string;
  priceSnapshot?: {
    basePrice: number;
    discount: number;
    tax: number;
    finalPrice: number;
    currency: string;
    freeReason: string | null;
  };
  metrics: { impressions: number; views: number; saves: number; shares: number; contacts: number };
};

export type CreateAdInput = {
  ownerId: number;
  title: string;
  description: string;
  categorySlug: string;
  cityCode: string;
  customCityName?: string | null;
  countryCode: string;
  mediaAssetIds: number[];
  contacts: { type: "store" | "product" | "whatsapp" | "phone"; value: string }[];
  accountType?: string;
};

async function resolveCategoryId(slug: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, 1)))
    .limit(1);
  if (!rows[0]) throw new Error("CATEGORY_NOT_FOUND");
  return rows[0];
}

async function resolveCityId(cityCode: string) {
  const db = requireDatabase(await getDb());
  const code = cityCode.startsWith("other") ? "other" : cityCode;
  const rows = await db
    .select({ id: cities.id, code: cities.code })
    .from(cities)
    .where(and(eq(cities.code, code), eq(cities.isActive, 1)))
    .limit(1);
  if (rows[0]) return rows[0];
  const fallback = await db
    .select({ id: cities.id, code: cities.code })
    .from(cities)
    .where(eq(cities.isActive, 1))
    .orderBy(asc(cities.sortOrder))
    .limit(1);
  if (!fallback[0]) throw new Error("CITY_NOT_FOUND");
  return fallback[0];
}

export async function listCountries() {
  const db = requireDatabase(await getDb());
  try {
    return await db
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
      .where(eq(countries.isActive, 1))
      .orderBy(asc(countries.sortOrder), asc(countries.id));
  } catch {
    return [];
  }
}

export async function createServerAd(input: CreateAdInput): Promise<FeedAdDto> {
  const db = requireDatabase(await getDb());
  const { policy, quote, blockPublishReason } = await resolveServerPublishQuote({
    countryCode: input.countryCode,
    categorySlug: input.categorySlug,
    accountType: input.accountType,
    userId: input.ownerId,
  });

  if (blockPublishReason) {
    throw new Error(blockPublishReason);
  }

  const scan = policy.aiModeration
    ? scanAdContent({
        title: input.title,
        description: input.description,
        contactValue: input.contacts[0]?.value,
      })
    : { label: "SAFE" as const, reasons: [], autoAction: "keep_published" as const, confidence: 0 };

  const category = await resolveCategoryId(input.categorySlug);
  const city = await resolveCityId(input.cityCode);
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let adStatus: (typeof ads.$inferInsert)["adStatus"] = "active";
  let paymentStatus: (typeof ads.$inferInsert)["paymentStatus"] = "not_required";
  let moderationStatus: (typeof ads.$inferInsert)["moderationStatus"] = "approved";
  let activatedAt: Date | null = now;
  let pausedAt: Date | null = null;

  if (quote.paymentStatus === "pending") {
    adStatus = "awaiting_payment";
    paymentStatus = "pending";
    moderationStatus = "not_submitted";
    activatedAt = null;
  } else if (scan.autoAction === "auto_pause") {
    adStatus = "paused";
    pausedAt = now;
    moderationStatus = "rejected";
  } else if (policy.manualPreApproval) {
    adStatus = "pending_review";
    moderationStatus = "queued";
    activatedAt = null;
  } else if (scan.autoAction === "flag_for_admin") {
    moderationStatus = "queued";
  }

  const adPublicId = publicId("ad");

  await db.transaction(async (tx) => {
    const ownedMedia =
      input.mediaAssetIds.length > 0
        ? await tx
            .select()
            .from(mediaAssets)
            .where(
              and(eq(mediaAssets.ownerId, input.ownerId), inArray(mediaAssets.id, input.mediaAssetIds)),
            )
        : [];
    if (ownedMedia.length !== input.mediaAssetIds.length) {
      throw new Error("MEDIA_ASSET_NOT_FOUND");
    }
    if (ownedMedia.some((asset) => asset.processingStatus !== "ready")) {
      throw new Error("MEDIA_ASSET_NOT_READY");
    }

    const insertAd = await tx.insert(ads).values({
      publicId: adPublicId,
      ownerId: input.ownerId,
      categoryId: category.id,
      cityId: city.id,
      countryCode: input.countryCode.toUpperCase(),
      adStatus,
      paymentStatus,
      mediaStatus: ownedMedia.length ? "ready" : "empty",
      moderationStatus,
      activatedAt,
      expiresAt: activatedAt ? expires : null,
      pausedAt,
    });
    const adId = Number(insertAd[0].insertId);

    const insertRev = await tx.insert(adRevisions).values({
      adId,
      version: 1,
      title: input.title.trim().slice(0, 120),
      description: input.description.trim(),
      customCityName: input.customCityName?.trim() || null,
      audienceScope: "kingdom",
      reviewStatus: adStatus === "active" ? "approved" : adStatus === "paused" ? "rejected" : "queued",
      submittedAt: now,
      decidedAt: adStatus === "active" || adStatus === "paused" ? now : null,
      decisionReason: scan.reasons.join(", ") || null,
      createdBy: input.ownerId,
    });
    const revisionId = Number(insertRev[0].insertId);

    await tx.update(ads).set({ currentRevisionId: revisionId }).where(eq(ads.id, adId));

    for (const [index, assetId] of input.mediaAssetIds.entries()) {
      await tx.insert(adMedia).values({
        revisionId,
        mediaAssetId: assetId,
        sortOrder: index,
      });
    }

    for (const [index, contact] of input.contacts.entries()) {
      await tx.insert(adContacts).values({
        revisionId,
        contactType: contact.type,
        contactValue: contact.value,
        sortOrder: index,
      });
    }

    let pricingRuleDbId: number | null = null;
    if (quote.pricingRuleId) {
      const ruleRows = await tx
        .select({ id: scopedPricingRules.id })
        .from(scopedPricingRules)
        .where(eq(scopedPricingRules.publicId, quote.pricingRuleId))
        .limit(1);
      pricingRuleDbId = ruleRows[0]?.id ?? null;
    }

    try {
      await tx.insert(adPriceSnapshots).values({
        adId,
        basePrice: quote.basePrice,
        discount: quote.discount,
        tax: quote.tax,
        finalPrice: quote.finalPrice,
        currency: quote.currency,
        pricingRuleId: pricingRuleDbId,
        freeReason: quote.freeReason,
        offerOrCoupon: quote.offerOrCoupon,
        paymentStatus: quote.paymentStatus === "pending" ? "pending" : "not_required",
        snapshotJson: quote,
      });
    } catch {
      // optional until migration 0005
    }

    if (policy.aiModeration && scan.label !== "SAFE") {
      try {
        await tx.insert(moderationCases).values({
          adId,
          revisionId,
          status: scan.autoAction === "auto_pause" ? "rejected" : "queued",
          riskScore: Math.round((scan.confidence ?? 0.5) * 100),
          automatedSignals: scan,
          decisionReason: scan.reasons.join(", ") || null,
          decidedAt: scan.autoAction === "auto_pause" ? now : null,
        });
      } catch {
        // optional
      }
    }
  });

  const dto = await getFeedAdByPublicId(adPublicId);
  if (!dto) throw new Error("AD_CREATE_FAILED");
  return dto;
}

async function mapAdRows(adIds: number[]): Promise<FeedAdDto[]> {
  if (!adIds.length) return [];
  const db = requireDatabase(await getDb());

  const baseRows = await db
    .select({
      id: ads.id,
      publicId: ads.publicId,
      ownerId: ads.ownerId,
      ownerOpenId: users.openId,
      categorySlug: categories.slug,
      cityCode: cities.code,
      cityNameAr: cities.nameAr,
      cityNameEn: cities.nameEn,
      countryCode: ads.countryCode,
      adStatus: ads.adStatus,
      paymentStatus: ads.paymentStatus,
      moderationStatus: ads.moderationStatus,
      createdAt: ads.createdAt,
      activatedAt: ads.activatedAt,
      expiresAt: ads.expiresAt,
      revisionId: ads.currentRevisionId,
      title: adRevisions.title,
      description: adRevisions.description,
      customCityName: adRevisions.customCityName,
      version: adRevisions.version,
    })
    .from(ads)
    .innerJoin(users, eq(ads.ownerId, users.id))
    .innerJoin(categories, eq(ads.categoryId, categories.id))
    .innerJoin(cities, eq(ads.cityId, cities.id))
    .leftJoin(adRevisions, eq(ads.currentRevisionId, adRevisions.id))
    .where(and(inArray(ads.id, adIds), isNull(ads.deletedAt)));

  const revisionIds = baseRows
    .map((row) => row.revisionId)
    .filter((id): id is number => typeof id === "number");

  const mediaRows = revisionIds.length
    ? await db
        .select({
          revisionId: adMedia.revisionId,
          mediaId: adMedia.id,
          mediaAssetId: mediaAssets.id,
          mediaType: mediaAssets.mediaType,
          originalUrl: mediaAssets.originalUrl,
          sortOrder: adMedia.sortOrder,
        })
        .from(adMedia)
        .innerJoin(mediaAssets, eq(adMedia.mediaAssetId, mediaAssets.id))
        .where(inArray(adMedia.revisionId, revisionIds))
        .orderBy(asc(adMedia.sortOrder))
    : [];

  const contactRows = revisionIds.length
    ? await db
        .select()
        .from(adContacts)
        .where(inArray(adContacts.revisionId, revisionIds))
        .orderBy(asc(adContacts.sortOrder))
    : [];

  const metricRows = await db
    .select({
      adId: adMetricsDaily.adId,
      impressions: sql<number>`sum(${adMetricsDaily.impressions})`,
      views: sql<number>`sum(${adMetricsDaily.views})`,
      saves: sql<number>`sum(${adMetricsDaily.saves})`,
      shares: sql<number>`sum(${adMetricsDaily.shares})`,
      contacts: sql<number>`sum(${adMetricsDaily.contactIntents})`,
    })
    .from(adMetricsDaily)
    .where(inArray(adMetricsDaily.adId, adIds))
    .groupBy(adMetricsDaily.adId);

  let snapshots: (typeof adPriceSnapshots.$inferSelect)[] = [];
  try {
    snapshots = await db.select().from(adPriceSnapshots).where(inArray(adPriceSnapshots.adId, adIds));
  } catch {
    snapshots = [];
  }

  let moderation: { adId: number; signals: unknown; status: string }[] = [];
  try {
    moderation = await db
      .select({
        adId: moderationCases.adId,
        signals: moderationCases.automatedSignals,
        status: moderationCases.status,
      })
      .from(moderationCases)
      .where(inArray(moderationCases.adId, adIds));
  } catch {
    moderation = [];
  }

  const byId = new Map(baseRows.map((row) => [row.id, row]));
  const ordered = adIds.map((id) => byId.get(id)).filter(Boolean) as typeof baseRows;

  return ordered.map((row) => {
    const media = mediaRows
      .filter((item) => item.revisionId === row.revisionId)
      .map((item) => ({
        id: String(item.mediaId),
        kind: item.mediaType,
        uri: item.originalUrl,
        mediaAssetId: item.mediaAssetId,
      }));
    const contacts = contactRows
      .filter((item) => item.revisionId === row.revisionId)
      .map((item) => ({ type: item.contactType, value: item.contactValue }));
    const metrics = metricRows.find((item) => item.adId === row.id);
    const snap = snapshots.find((item) => item.adId === row.id);
    const mod = moderation.find((item) => item.adId === row.id);
    const signals = mod?.signals as { label?: "SAFE" | "NEEDS_REVIEW" | "BLOCKED" } | null;
    let aiLabel = signals?.label;
    if (!aiLabel && row.moderationStatus === "queued") aiLabel = "NEEDS_REVIEW";
    if (!aiLabel && row.adStatus === "paused" && row.moderationStatus === "rejected") aiLabel = "BLOCKED";

    return {
      id: row.publicId,
      ownerId: String(row.ownerId),
      title: row.title ?? "",
      description: row.description ?? "",
      categoryId: row.categorySlug,
      cityId: row.cityCode,
      cityNameAr: row.cityNameAr,
      cityNameEn: row.cityNameEn,
      customCityName: row.customCityName,
      countryCode: row.countryCode,
      media,
      contacts,
      status: row.adStatus,
      revision: row.version ?? 1,
      verified: false,
      featured: false,
      sponsored: false,
      createdAt: row.createdAt.toISOString(),
      activatedAt: row.activatedAt?.toISOString(),
      expiresAt: row.expiresAt?.toISOString(),
      promotions: [],
      aiLabel,
      paymentStatus: row.paymentStatus,
      priceSnapshot: snap
        ? {
            basePrice: snap.basePrice,
            discount: snap.discount,
            tax: snap.tax,
            finalPrice: snap.finalPrice,
            currency: snap.currency,
            freeReason: snap.freeReason,
          }
        : undefined,
      metrics: {
        impressions: Number(metrics?.impressions ?? 0),
        views: Number(metrics?.views ?? 0),
        saves: Number(metrics?.saves ?? 0),
        shares: Number(metrics?.shares ?? 0),
        contacts: Number(metrics?.contacts ?? 0),
      },
    };
  });
}

export async function getFeedAdByPublicId(publicAdId: string): Promise<FeedAdDto | null> {
  const db = requireDatabase(await getDb());
  const rows = await db.select({ id: ads.id }).from(ads).where(eq(ads.publicId, publicAdId)).limit(1);
  if (!rows[0]) return null;
  const mapped = await mapAdRows([rows[0].id]);
  return mapped[0] ?? null;
}

export async function listFeedAds(input: {
  countryCode?: string | null;
  forceCountryFilter?: boolean;
  categorySlug?: string | null;
  limit?: number;
}): Promise<FeedAdDto[]> {
  const db = requireDatabase(await getDb());
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);

  const conditions = [eq(ads.adStatus, "active"), isNull(ads.deletedAt)];
  if (input.forceCountryFilter && input.countryCode && input.countryCode !== "ALL") {
    conditions.push(eq(ads.countryCode, input.countryCode.toUpperCase()));
  }
  if (input.categorySlug) {
    const category = await resolveCategoryId(input.categorySlug).catch(() => null);
    if (category) conditions.push(eq(ads.categoryId, category.id));
  }

  const rows = await db
    .select({ id: ads.id })
    .from(ads)
    .where(and(...conditions))
    .orderBy(desc(ads.activatedAt), desc(ads.createdAt))
    .limit(limit);

  return mapAdRows(rows.map((row) => row.id));
}

export async function listMineAds(ownerId: number): Promise<FeedAdDto[]> {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ id: ads.id })
    .from(ads)
    .where(and(eq(ads.ownerId, ownerId), isNull(ads.deletedAt)))
    .orderBy(desc(ads.createdAt))
    .limit(100);
  return mapAdRows(rows.map((row) => row.id));
}

export async function toggleFavorite(userId: number, publicAdId: string) {
  const db = requireDatabase(await getDb());
  const adRows = await db.select({ id: ads.id }).from(ads).where(eq(ads.publicId, publicAdId)).limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  const adId = adRows[0].id;
  const existing = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.adId, adId)))
    .limit(1);
  if (existing[0]) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return { saved: false as const };
  }
  await db.insert(favorites).values({ userId, adId });
  await bumpDailyMetric(adId, "saves", 1);
  return { saved: true as const };
}

export async function listSavedAdIds(userId: number): Promise<string[]> {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ publicId: ads.publicId })
    .from(favorites)
    .innerJoin(ads, eq(favorites.adId, ads.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  return rows.map((row) => row.publicId);
}

export async function listSavedAds(userId: number): Promise<FeedAdDto[]> {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ id: ads.id })
    .from(favorites)
    .innerJoin(ads, eq(favorites.adId, ads.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  return mapAdRows(rows.map((row) => row.id));
}

export async function reportAd(input: {
  publicAdId: string;
  reporterId?: number | null;
  reason: "spam" | "fraud" | "prohibited" | "misleading" | "copyright" | "other";
  details?: string;
}) {
  const db = requireDatabase(await getDb());
  const adRows = await db.select({ id: ads.id }).from(ads).where(eq(ads.publicId, input.publicAdId)).limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  await db.insert(reports).values({
    publicId: publicId("rep", 32),
    reporterId: input.reporterId ?? null,
    adId: adRows[0].id,
    reason: input.reason,
    details: input.details ?? null,
    status: "open",
  });
  await recordAdEvent({
    publicAdId: input.publicAdId,
    userId: input.reporterId ?? null,
    eventType: "report",
    dedupeSuffix: `${input.reporterId ?? "anon"}-${Date.now()}`,
  });
  return { ok: true as const };
}

export async function recordAdEvent(input: {
  publicAdId: string;
  userId?: number | null;
  anonymousId?: string | null;
  eventType: "impression" | "view" | "save" | "share" | "store_click" | "product_click" | "whatsapp_click" | "phone_click" | "report";
  dedupeSuffix: string;
}) {
  const db = requireDatabase(await getDb());
  const adRows = await db.select({ id: ads.id }).from(ads).where(eq(ads.publicId, input.publicAdId)).limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  const dedupeKey = `${input.publicAdId}:${input.eventType}:${input.dedupeSuffix}`.slice(0, 160);
  try {
    await db.insert(adEvents).values({
      adId: adRows[0].id,
      userId: input.userId ?? null,
      anonymousId: input.anonymousId ?? null,
      eventType: input.eventType,
      dedupeKey,
    });
  } catch {
    return { ok: true as const, deduped: true };
  }

  const metricKey =
    input.eventType === "impression"
      ? "impressions"
      : input.eventType === "view"
        ? "views"
        : input.eventType === "save"
          ? "saves"
          : input.eventType === "share"
            ? "shares"
            : input.eventType.endsWith("_click")
              ? "contactIntents"
              : null;
  if (metricKey) await bumpDailyMetric(adRows[0].id, metricKey, 1);
  return { ok: true as const, deduped: false };
}

async function bumpDailyMetric(
  adId: number,
  key: "impressions" | "views" | "saves" | "shares" | "contactIntents",
  delta: number,
) {
  const db = requireDatabase(await getDb());
  const metricDate = new Date().toISOString().slice(0, 10);
  const existing = await db
    .select()
    .from(adMetricsDaily)
    .where(and(eq(adMetricsDaily.adId, adId), eq(adMetricsDaily.metricDate, metricDate)))
    .limit(1);
  if (!existing[0]) {
    await db.insert(adMetricsDaily).values({
      adId,
      metricDate,
      impressions: key === "impressions" ? delta : 0,
      views: key === "views" ? delta : 0,
      saves: key === "saves" ? delta : 0,
      shares: key === "shares" ? delta : 0,
      contactIntents: key === "contactIntents" ? delta : 0,
    });
    return;
  }
  await db
    .update(adMetricsDaily)
    .set({ [key]: sql`${adMetricsDaily[key]} + ${delta}` })
    .where(eq(adMetricsDaily.id, existing[0].id));
}

export async function appealPausedAd(input: {
  userId: number;
  publicAdId: string;
  message: string;
}) {
  const db = requireDatabase(await getDb());
  const adRows = await db
    .select({ id: ads.id, ownerId: ads.ownerId, adStatus: ads.adStatus })
    .from(ads)
    .where(eq(ads.publicId, input.publicAdId))
    .limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  if (adRows[0].ownerId !== input.userId) throw new Error("AD_FORBIDDEN");
  if (adRows[0].adStatus !== "paused") throw new Error("AD_NOT_PAUSED");

  const cases = await db
    .select({ id: moderationCases.id })
    .from(moderationCases)
    .where(eq(moderationCases.adId, adRows[0].id))
    .orderBy(desc(moderationCases.id))
    .limit(1);
  if (!cases[0]) throw new Error("MODERATION_CASE_NOT_FOUND");

  await db.insert(appeals).values({
    caseId: cases[0].id,
    userId: input.userId,
    message: input.message.trim().slice(0, 2000),
    status: "open",
  });
  await db
    .update(moderationCases)
    .set({ status: "appealed" })
    .where(eq(moderationCases.id, cases[0].id));
  return { ok: true as const };
}

export async function adminSetAdStatus(input: {
  actorId: number;
  publicAdId: string;
  status: "active" | "paused" | "removed";
  reason?: string;
}) {
  const db = requireDatabase(await getDb());
  const adRows = await db.select().from(ads).where(eq(ads.publicId, input.publicAdId)).limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  const now = new Date();
  await db
    .update(ads)
    .set({
      adStatus: input.status,
      pausedAt: input.status === "paused" ? now : null,
      deletedAt: input.status === "removed" ? now : null,
      activatedAt: input.status === "active" ? adRows[0].activatedAt ?? now : adRows[0].activatedAt,
    })
    .where(eq(ads.id, adRows[0].id));
  return { ok: true as const, reason: input.reason ?? null };
}
