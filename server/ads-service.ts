import { and, asc, desc, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

import {
  adContacts,
  adEvents,
  adMedia,
  adMetricsDaily,
  adPriceSnapshots,
  adRevisions,
  advertiserProfiles,
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
import { writeAuditLog } from "./audit-service";
import {
  enforceRollingLimit,
  findIdempotentAction,
  lockIdentity,
  recordIdentityAction,
  type ContentIdentity,
} from "./content-identity";
import { recordCouponRedemption } from "./coupons-service";
import { getDb, requireDatabase } from "./db";
import { notifyAdPaused, notifyAdPublished } from "./notifications-service";
import { loadLaunchPolicy, resolveServerPublishQuote } from "./pricing-service";
import { ensureAdvertiserProfile } from "./profile-service";

function publicId(prefix: string, max = 24) {
  return `${prefix}${randomBytes(8).toString("hex")}`.slice(0, max);
}

export type FeedAdDto = {
  id: string;
  ownerId: string;
  advertiser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    verified: boolean;
  };
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
  identity: ContentIdentity;
  idempotencyKey: string;
  title: string;
  description: string;
  categorySlug: string;
  cityCode: string;
  customCityName?: string | null;
  countryCode: string;
  mediaAssetIds: number[];
  contacts: { type: "store" | "product" | "whatsapp" | "phone"; value: string }[];
  accountType?: string;
  couponCode?: string;
  sourcePostId?: string;
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
  const candidates = [cityCode];
  if (cityCode.startsWith("other") && cityCode !== "other") candidates.push("other");
  for (const code of candidates) {
    const rows = await db
      .select({ id: cities.id, code: cities.code })
      .from(cities)
      .where(and(eq(cities.code, code), eq(cities.isActive, 1)))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  const fallback = await db
    .select({ id: cities.id, code: cities.code })
    .from(cities)
    .where(eq(cities.isActive, 1))
    .orderBy(asc(cities.sortOrder))
    .limit(1);
  if (!fallback[0]) throw new Error("CITY_NOT_FOUND");
  return fallback[0];
}

function adOwnerCondition(identity: ContentIdentity) {
  return identity.kind === "user"
    ? eq(ads.ownerId, identity.userId)
    : eq(ads.ownerVisitorSessionId, identity.visitorSessionId);
}

function mediaOwnerCondition(identity: ContentIdentity) {
  return identity.kind === "user"
    ? eq(mediaAssets.ownerId, identity.userId)
    : eq(mediaAssets.ownerVisitorSessionId, identity.visitorSessionId);
}

function sanitizeContact(contact: CreateAdInput["contacts"][number]) {
  const value = contact.value.trim();
  if (contact.type === "phone" || contact.type === "whatsapp") {
    const normalized = value.replace(/[\s()-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("CONTACT_PHONE_INVALID");
    return { type: contact.type, value: normalized };
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("CONTACT_URL_INVALID");
  }
  if (parsed.protocol !== "https:") throw new Error("CONTACT_URL_INVALID");
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return { type: contact.type, value: parsed.toString().slice(0, 1024) };
}

async function recentOwnerTexts(identity: ContentIdentity): Promise<string[]> {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ title: adRevisions.title, description: adRevisions.description })
    .from(ads)
    .innerJoin(adRevisions, eq(ads.currentRevisionId, adRevisions.id))
    .where(and(adOwnerCondition(identity), isNull(ads.deletedAt)))
    .orderBy(desc(ads.createdAt))
    .limit(8);
  return rows.map((row) => `${row.title}\n${row.description}`);
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
  const profile = await ensureAdvertiserProfile(input.identity);
  const { policy, quote, blockPublishReason, couponId } = await resolveServerPublishQuote({
    countryCode: input.countryCode,
    categorySlug: input.categorySlug,
    accountType: input.accountType,
    userId: input.identity.userId ?? undefined,
    couponCode: input.couponCode,
  });

  if (input.identity.kind === "visitor") {
    if (policy.authenticationRequired || !policy.guestPublishingEnabled) {
      throw new Error("GUEST_PUBLISHING_DISABLED");
    }
    if (policy.verificationRequiredForPublishing) {
      throw new Error("PUBLISHING_VERIFICATION_REQUIRED");
    }
  }
  if (blockPublishReason) {
    throw new Error(blockPublishReason);
  }

  const contacts = input.contacts.map(sanitizeContact);
  const priorTexts = policy.aiModeration
    ? await recentOwnerTexts(input.identity).catch(() => [])
    : [];
  const scan = policy.aiModeration
    ? scanAdContent({
        title: input.title,
        description: input.description,
        contactValue: contacts[0]?.value,
        recentOwnerTexts: priorTexts,
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
  } else if (policy.moderationMode === "pre_publish" && policy.manualPreApproval) {
    adStatus = "pending_review";
    moderationStatus = "queued";
    activatedAt = null;
  } else if (scan.autoAction === "flag_for_admin") {
    moderationStatus = "queued";
  }

  const requestedPublicId = publicId("ad");

  const creation = await db.transaction(async (tx) => {
    await lockIdentity(tx, input.identity);
    const duplicate = await findIdempotentAction(tx, input.idempotencyKey, "main_ad");
    if (duplicate) return { publicId: duplicate, duplicate: true as const };
    await enforceRollingLimit(tx, {
      identity: input.identity,
      actionType: "main_ad",
      limit: policy.mainAdsDailyLimit,
    });
    const ownedMedia =
      input.mediaAssetIds.length > 0
        ? await tx
            .select()
            .from(mediaAssets)
            .where(
              and(mediaOwnerCondition(input.identity), inArray(mediaAssets.id, input.mediaAssetIds)),
            )
        : [];
    if (ownedMedia.length !== input.mediaAssetIds.length) {
      throw new Error("MEDIA_ASSET_NOT_FOUND");
    }
    if (ownedMedia.some((asset) => asset.processingStatus !== "ready")) {
      throw new Error("MEDIA_ASSET_NOT_READY");
    }

    const insertAd = await tx.insert(ads).values({
      publicId: requestedPublicId,
      ownerId: input.identity.userId,
      ownerVisitorSessionId: input.identity.visitorSessionId,
      advertiserProfileId: profile.id,
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
      createdBy: input.identity.userId,
      createdByVisitorSessionId: input.identity.visitorSessionId,
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

    for (const [index, contact] of contacts.entries()) {
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
    await recordIdentityAction(tx, {
      identity: input.identity,
      actionType: "main_ad",
      contentPublicId: requestedPublicId,
      idempotencyKey: input.idempotencyKey,
    });
    return { publicId: requestedPublicId, duplicate: false as const };
  });
  const adPublicId = creation.publicId;

  if (!creation.duplicate && couponId && input.identity.userId) {
    const adRows = await db
      .select({ id: ads.id })
      .from(ads)
      .where(eq(ads.publicId, adPublicId))
      .limit(1);
    if (adRows[0]) {
      await recordCouponRedemption({
        couponId,
        userId: input.identity.userId,
        adId: adRows[0].id,
      }).catch(() => undefined);
    }
  }

  const dto = await getFeedAdByPublicId(adPublicId);
  if (!dto) throw new Error("AD_CREATE_FAILED");

  if (!creation.duplicate && dto.status === "active" && input.identity.userId) {
    await notifyAdPublished(input.identity.userId, dto.id, dto.title).catch(() => undefined);
  } else if (!creation.duplicate && dto.status === "paused" && input.identity.userId) {
    await notifyAdPaused(
      input.identity.userId,
      dto.id,
      scan.reasons.join(", ") || "Paused by moderation",
    ).catch(() => undefined);
  }

  if (!creation.duplicate) {
    await writeAuditLog({
      actorId: input.identity.userId,
      actorVisitorSessionId: input.identity.visitorSessionId,
      actorRole: input.identity.kind === "user" ? "advertiser" : "visitor",
      action: "ad.create",
      entityType: "ad",
      entityId: dto.id,
      afterState: { status: dto.status, paymentStatus: dto.paymentStatus, countryCode: dto.countryCode },
    }).catch(() => undefined);
  }

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
      profilePublicId: advertiserProfiles.publicId,
      profileUsername: advertiserProfiles.username,
      profileDisplayName: advertiserProfiles.displayName,
      profileAvatarUrl: advertiserProfiles.avatarUrl,
      profileVerified: advertiserProfiles.isVerified,
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
    .leftJoin(users, eq(ads.ownerId, users.id))
    .leftJoin(advertiserProfiles, eq(ads.advertiserProfileId, advertiserProfiles.id))
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

  let moderation: { adId: number | null; signals: unknown; status: string }[] = [];
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
      ownerId: row.profilePublicId ?? (row.ownerId ? `user-${row.ownerId}` : "legacy-advertiser"),
      advertiser: {
        id: row.profilePublicId ?? (row.ownerId ? `user-${row.ownerId}` : "legacy-advertiser"),
        username: row.profileUsername ?? `advertiser_${row.ownerId ?? "legacy"}`,
        displayName: row.profileDisplayName ?? "معلن إعلاني",
        avatarUrl: row.profileAvatarUrl,
        verified: row.profileVerified === 1,
      },
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
      verified: row.profileVerified === 1,
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

export async function listMineAds(identity: ContentIdentity): Promise<FeedAdDto[]> {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ id: ads.id })
    .from(ads)
    .where(and(adOwnerCondition(identity), isNull(ads.deletedAt)))
    .orderBy(desc(ads.createdAt))
    .limit(100);
  return mapAdRows(rows.map((row) => row.id));
}

export async function listAdvertiserAds(username: string): Promise<FeedAdDto[]> {
  const db = requireDatabase(await getDb());
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const profile = await db
    .select({ id: advertiserProfiles.id })
    .from(advertiserProfiles)
    .where(
      and(
        eq(advertiserProfiles.username, normalized),
        eq(advertiserProfiles.status, "active"),
      ),
    )
    .limit(1);
  if (!profile[0]) throw new Error("ADVERTISER_PROFILE_NOT_FOUND");
  const rows = await db
    .select({ id: ads.id })
    .from(ads)
    .where(
      and(
        eq(ads.advertiserProfileId, profile[0].id),
        eq(ads.adStatus, "active"),
        isNull(ads.deletedAt),
      ),
    )
    .orderBy(desc(ads.activatedAt), desc(ads.createdAt))
    .limit(100);
  return mapAdRows(rows.map((row) => row.id));
}

function favoriteIdentityCondition(identity: ContentIdentity) {
  return identity.kind === "user"
    ? eq(favorites.userId, identity.userId)
    : eq(favorites.visitorSessionId, identity.visitorSessionId);
}

export async function toggleFavorite(identity: ContentIdentity, publicAdId: string) {
  const db = requireDatabase(await getDb());
  const adRows = await db.select({ id: ads.id }).from(ads).where(eq(ads.publicId, publicAdId)).limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  const adId = adRows[0].id;
  const existing = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(favoriteIdentityCondition(identity), eq(favorites.adId, adId)))
    .limit(1);
  if (existing[0]) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return { saved: false as const };
  }
  await db.insert(favorites).values({
    userId: identity.userId,
    visitorSessionId: identity.visitorSessionId,
    adId,
  });
  await bumpDailyMetric(adId, "saves", 1);
  return { saved: true as const };
}

export async function listSavedAdIds(identity: ContentIdentity): Promise<string[]> {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ publicId: ads.publicId })
    .from(favorites)
    .innerJoin(ads, eq(favorites.adId, ads.id))
    .where(favoriteIdentityCondition(identity))
    .orderBy(desc(favorites.createdAt));
  return rows.map((row) => row.publicId);
}

export async function listSavedAds(identity: ContentIdentity): Promise<FeedAdDto[]> {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ id: ads.id })
    .from(favorites)
    .innerJoin(ads, eq(favorites.adId, ads.id))
    .where(favoriteIdentityCondition(identity))
    .orderBy(desc(favorites.createdAt));
  return mapAdRows(rows.map((row) => row.id));
}

export async function reportAd(input: {
  identity: ContentIdentity;
  idempotencyKey: string;
  publicAdId: string;
  reason:
    | "spam"
    | "fraud"
    | "prohibited"
    | "misleading"
    | "copyright"
    | "impersonation"
    | "sexual"
    | "weapons"
    | "drugs"
    | "other";
  details?: string;
}) {
  const db = requireDatabase(await getDb());
  const policy = await loadLaunchPolicy();
  const adRows = await db
    .select({ id: ads.id, revisionId: ads.currentRevisionId })
    .from(ads)
    .where(eq(ads.publicId, input.publicAdId))
    .limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  const reportPublicId = publicId("rep", 32);
  await db.transaction(async (tx) => {
    await lockIdentity(tx, input.identity);
    const duplicate = await findIdempotentAction(tx, input.idempotencyKey, "report");
    if (duplicate) return duplicate;
    await enforceRollingLimit(tx, {
      identity: input.identity,
      actionType: "report",
      limit: policy.reportDailyLimit,
    });
    await tx.insert(reports).values({
      publicId: reportPublicId,
      reporterId: input.identity.userId,
      reporterVisitorSessionId: input.identity.visitorSessionId,
      adId: adRows[0].id,
      reason: input.reason,
      details: input.details?.trim().slice(0, 2000) ?? null,
      status: "open",
    });
    if (adRows[0].revisionId) {
      const openCase = await tx
        .select({ id: moderationCases.id })
        .from(moderationCases)
        .where(
          and(
            eq(moderationCases.adId, adRows[0].id),
            inArray(moderationCases.status, ["queued", "in_review", "appealed"]),
          ),
        )
        .limit(1);
      if (!openCase[0]) {
        await tx.insert(moderationCases).values({
          adId: adRows[0].id,
          revisionId: adRows[0].revisionId,
          status: "queued",
          riskScore: input.reason === "weapons" || input.reason === "drugs" || input.reason === "sexual" ? 85 : 50,
          automatedSignals: { source: "user_report", reason: input.reason },
        });
      }
    }
    await recordIdentityAction(tx, {
      identity: input.identity,
      actionType: "report",
      contentPublicId: reportPublicId,
      idempotencyKey: input.idempotencyKey,
    });
    return reportPublicId;
  });
  await recordAdEvent({
    publicAdId: input.publicAdId,
    userId: input.identity.userId,
    anonymousId:
      input.identity.kind === "visitor" ? `visitor:${input.identity.visitorSessionId}` : null,
    eventType: "report",
    dedupeSuffix: input.idempotencyKey,
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

  if (input.status === "paused" && adRows[0].ownerId) {
    await notifyAdPaused(
      adRows[0].ownerId,
      input.publicAdId,
      input.reason || "Paused by admin",
    ).catch(() => undefined);
  } else if (input.status === "active" && adRows[0].ownerId) {
    const rev = adRows[0].currentRevisionId
      ? await db
          .select({ title: adRevisions.title })
          .from(adRevisions)
          .where(eq(adRevisions.id, adRows[0].currentRevisionId))
          .limit(1)
      : [];
    await notifyAdPublished(adRows[0].ownerId, input.publicAdId, rev[0]?.title ?? input.publicAdId).catch(
      () => undefined,
    );
  }

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "admin",
    action: `ad.admin_${input.status}`,
    entityType: "ad",
    entityId: input.publicAdId,
    reason: input.reason ?? null,
    beforeState: { adStatus: adRows[0].adStatus },
    afterState: { adStatus: input.status },
  }).catch(() => undefined);

  return { ok: true as const, reason: input.reason ?? null };
}

async function requireOwnedAd(identity: ContentIdentity, publicAdId: string) {
  const db = requireDatabase(await getDb());
  const adRows = await db
    .select()
    .from(ads)
    .where(and(eq(ads.publicId, publicAdId), adOwnerCondition(identity), isNull(ads.deletedAt)))
    .limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  return adRows[0];
}

export async function updateServerAd(input: {
  identity: ContentIdentity;
  publicAdId: string;
  title?: string;
  description?: string;
  contacts?: { type: "store" | "product" | "whatsapp" | "phone"; value: string }[];
  customCityName?: string | null;
}) {
  const db = requireDatabase(await getDb());
  const ad = await requireOwnedAd(input.identity, input.publicAdId);
  if (!ad.currentRevisionId) throw new Error("AD_REVISION_NOT_FOUND");

  const current = await db
    .select()
    .from(adRevisions)
    .where(eq(adRevisions.id, ad.currentRevisionId))
    .limit(1);
  if (!current[0]) throw new Error("AD_REVISION_NOT_FOUND");

  const title = (input.title ?? current[0].title).trim().slice(0, 120);
  const description = (input.description ?? current[0].description).trim();
  if (title.length < 4) throw new Error("AD_TITLE_INVALID");
  if (description.length < 20) throw new Error("AD_DESCRIPTION_INVALID");

  const now = new Date();
  const insertRev = await db.insert(adRevisions).values({
    adId: ad.id,
    version: (current[0].version ?? 1) + 1,
    title,
    description,
    customCityName:
      input.customCityName !== undefined ? input.customCityName?.trim() || null : current[0].customCityName,
    audienceScope: current[0].audienceScope,
    reviewStatus: "approved",
    submittedAt: now,
    decidedAt: now,
    createdBy: input.identity.userId,
    createdByVisitorSessionId: input.identity.visitorSessionId,
  });
  const revisionId = Number(insertRev[0].insertId);

  const mediaRows = await db
    .select()
    .from(adMedia)
    .where(eq(adMedia.revisionId, ad.currentRevisionId))
    .orderBy(asc(adMedia.sortOrder));
  for (const media of mediaRows) {
    await db.insert(adMedia).values({
      revisionId,
      mediaAssetId: media.mediaAssetId,
      sortOrder: media.sortOrder,
      altTextAr: media.altTextAr,
      altTextEn: media.altTextEn,
    });
  }

  let contacts = input.contacts?.map(sanitizeContact);
  if (!contacts) {
    const contactRows = await db
      .select()
      .from(adContacts)
      .where(eq(adContacts.revisionId, ad.currentRevisionId))
      .orderBy(asc(adContacts.sortOrder));
    contacts = contactRows.map((row) => ({ type: row.contactType, value: row.contactValue }));
  }

  for (const [index, contact] of contacts.entries()) {
    await db.insert(adContacts).values({
      revisionId,
      contactType: contact.type,
      contactValue: contact.value,
      sortOrder: index,
    });
  }

  await db.update(ads).set({ currentRevisionId: revisionId }).where(eq(ads.id, ad.id));
  await writeAuditLog({
    actorId: input.identity.userId,
    actorVisitorSessionId: input.identity.visitorSessionId,
    actorRole: input.identity.kind === "user" ? "advertiser" : "visitor",
    action: "ad.update",
    entityType: "ad",
    entityId: input.publicAdId,
    afterState: { revisionId, title },
  }).catch(() => undefined);

  const dto = await getFeedAdByPublicId(input.publicAdId);
  if (!dto) throw new Error("AD_UPDATE_FAILED");
  return dto;
}

export async function pauseServerAd(input: { identity: ContentIdentity; publicAdId: string; reason?: string }) {
  const ad = await requireOwnedAd(input.identity, input.publicAdId);
  if (ad.adStatus !== "active" && ad.adStatus !== "pending_review") {
    throw new Error("AD_NOT_PAUSABLE");
  }
  const db = requireDatabase(await getDb());
  const now = new Date();
  await db
    .update(ads)
    .set({ adStatus: "paused", pausedAt: now })
    .where(eq(ads.id, ad.id));
  if (input.identity.userId) {
    await notifyAdPaused(input.identity.userId, input.publicAdId, input.reason || "Paused by owner").catch(
      () => undefined,
    );
  }
  await writeAuditLog({
    actorId: input.identity.userId,
    actorVisitorSessionId: input.identity.visitorSessionId,
    actorRole: input.identity.kind === "user" ? "advertiser" : "visitor",
    action: "ad.pause",
    entityType: "ad",
    entityId: input.publicAdId,
    reason: input.reason ?? null,
  }).catch(() => undefined);
  return { ok: true as const };
}

export async function publishServerAd(input: { identity: ContentIdentity; publicAdId: string }) {
  const ad = await requireOwnedAd(input.identity, input.publicAdId);
  if (ad.paymentStatus === "pending") throw new Error("AD_AWAITING_PAYMENT");
  if (ad.moderationStatus === "rejected") throw new Error("AD_MODERATION_REJECTED");
  if (!["paused", "draft", "pending_review", "expired"].includes(ad.adStatus)) {
    throw new Error("AD_NOT_PUBLISHABLE");
  }
  const db = requireDatabase(await getDb());
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db
    .update(ads)
    .set({
      adStatus: "active",
      pausedAt: null,
      activatedAt: ad.activatedAt ?? now,
      expiresAt: expires,
      moderationStatus: ad.moderationStatus === "queued" ? "queued" : "approved",
    })
    .where(eq(ads.id, ad.id));

  const rev = ad.currentRevisionId
    ? await db
        .select({ title: adRevisions.title })
        .from(adRevisions)
        .where(eq(adRevisions.id, ad.currentRevisionId))
        .limit(1)
    : [];
  if (input.identity.userId) {
    await notifyAdPublished(
      input.identity.userId,
      input.publicAdId,
      rev[0]?.title ?? input.publicAdId,
    ).catch(() => undefined);
  }
  await writeAuditLog({
    actorId: input.identity.userId,
    actorVisitorSessionId: input.identity.visitorSessionId,
    actorRole: input.identity.kind === "user" ? "advertiser" : "visitor",
    action: "ad.publish",
    entityType: "ad",
    entityId: input.publicAdId,
  }).catch(() => undefined);
  return getFeedAdByPublicId(input.publicAdId);
}

export async function deleteServerAd(input: { identity: ContentIdentity; publicAdId: string }) {
  const ad = await requireOwnedAd(input.identity, input.publicAdId);
  const db = requireDatabase(await getDb());
  const now = new Date();
  await db
    .update(ads)
    .set({ adStatus: "removed", deletedAt: now, pausedAt: now })
    .where(eq(ads.id, ad.id));
  await writeAuditLog({
    actorId: input.identity.userId,
    actorVisitorSessionId: input.identity.visitorSessionId,
    actorRole: input.identity.kind === "user" ? "advertiser" : "visitor",
    action: "ad.delete",
    entityType: "ad",
    entityId: input.publicAdId,
  }).catch(() => undefined);
  return { ok: true as const };
}

/** Delete orphan media assets not linked to any revision (failed publish leftovers). */
export async function cleanupOrphanMediaAssets(input?: {
  olderThanMinutes?: number;
  limit?: number;
  ownerId?: number;
}) {
  const db = requireDatabase(await getDb());
  const olderThanMinutes = Math.max(input?.olderThanMinutes ?? 60, 5);
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const linked = await db.select({ mediaAssetId: adMedia.mediaAssetId }).from(adMedia);
  const linkedIds = [...new Set(linked.map((row) => row.mediaAssetId))];

  const conditions = [lt(mediaAssets.createdAt, cutoff)];
  if (input?.ownerId) conditions.push(eq(mediaAssets.ownerId, input.ownerId));
  if (linkedIds.length) conditions.push(notInArray(mediaAssets.id, linkedIds));

  const orphans = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(and(...conditions))
    .orderBy(asc(mediaAssets.createdAt))
    .limit(limit);

  let deleted = 0;
  for (const orphan of orphans) {
    await db.delete(mediaAssets).where(eq(mediaAssets.id, orphan.id));
    deleted += 1;
  }
  return { ok: true as const, deleted, scanned: orphans.length };
}
