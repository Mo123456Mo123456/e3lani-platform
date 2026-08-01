import { and, asc, desc, eq, gt, isNull, lte, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  adMedia,
  adRevisions,
  ads,
  appSettings,
  authRateLimits,
  authSessions,
  categories,
  cities,
  InsertUser,
  mediaAssets,
  pricingRules,
  pricingVersions,
  promotions,
  regions,
  users,
} from "../drizzle/schema";
import { normalizeMediaPolicy } from "../shared/media-policy";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "phone", "countryCode"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.accountType !== undefined) {
      values.accountType = user.accountType;
      updateSet.accountType = user.accountType;
    }
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export function requireDatabase<T>(database: T | null): T {
  if (!database) throw new Error("Database is unavailable");
  return database;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing or invalid central setting: ${path}`);
  }
  return value;
}

export async function getPublicCatalog() {
  const db = requireDatabase(await getDb());

  const [regionRows, cityRows, categoryRows] = await Promise.all([
    db
      .select({
        databaseId: regions.id,
        id: regions.code,
        nameAr: regions.nameAr,
        nameEn: regions.nameEn,
        sortOrder: regions.sortOrder,
      })
      .from(regions)
      .where(eq(regions.isActive, 1))
      .orderBy(asc(regions.sortOrder), asc(regions.id)),
    db
      .select({
        databaseId: cities.id,
        id: cities.code,
        regionDatabaseId: regions.id,
        regionId: regions.code,
        countryId: cities.countryId,
        nameAr: cities.nameAr,
        nameEn: cities.nameEn,
        latitudeE6: cities.latitudeE6,
        longitudeE6: cities.longitudeE6,
        sortOrder: cities.sortOrder,
      })
      .from(cities)
      .innerJoin(regions, eq(cities.regionId, regions.id))
      .where(and(eq(cities.isActive, 1), eq(regions.isActive, 1)))
      .orderBy(asc(cities.sortOrder), asc(cities.id)),
    db
      .select({
        databaseId: categories.id,
        parentDatabaseId: categories.parentId,
        id: categories.slug,
        nameAr: categories.nameAr,
        nameEn: categories.nameEn,
        icon: categories.icon,
        reviewPolicy: categories.reviewPolicy,
        sortOrder: categories.sortOrder,
      })
      .from(categories)
      .where(eq(categories.isActive, 1))
      .orderBy(asc(categories.sortOrder), asc(categories.id)),
  ]);

  const categorySlugById = new Map(categoryRows.map((category) => [category.databaseId, category.id]));

  return {
    regions: regionRows,
    cities: cityRows,
    categories: categoryRows.map((category) => ({
      ...category,
      parentId: category.parentDatabaseId ? categorySlugById.get(category.parentDatabaseId) ?? null : null,
    })),
  };
}

export async function getPublicProductConfig() {
  const db = requireDatabase(await getDb());

  const pricingVersionRows = await db
    .select()
    .from(pricingVersions)
    .where(and(eq(pricingVersions.isActive, 1), lte(pricingVersions.effectiveFrom, new Date())))
    .orderBy(desc(pricingVersions.version))
    .limit(1);

  const pricingVersion = pricingVersionRows[0];
  if (!pricingVersion) throw new Error("No active pricing version is configured");

  const [ruleRows, promotionRows, settingRows] = await Promise.all([
    db
      .select({
        code: pricingRules.code,
        labelAr: pricingRules.labelAr,
        labelEn: pricingRules.labelEn,
        priceHalalas: pricingRules.priceHalalas,
        durationDays: pricingRules.durationDays,
      })
      .from(pricingRules)
      .where(and(eq(pricingRules.pricingVersionId, pricingVersion.id), eq(pricingRules.isActive, 1)))
      .orderBy(asc(pricingRules.id)),
    db
      .select({
        code: promotions.code,
        type: promotions.type,
        labelAr: promotions.labelAr,
        labelEn: promotions.labelEn,
      })
      .from(promotions)
      .where(eq(promotions.isActive, 1))
      .orderBy(asc(promotions.id)),
    db
      .select({ key: appSettings.settingKey, value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.isPublic, 1)),
  ]);

  const settings = new Map(settingRows.map((setting) => [setting.key, asObject(setting.value)]));
  const adsPolicy = settings.get("ads.policy") ?? {};
  const mediaPolicy = normalizeMediaPolicy(settings.get("media.policy"), adsPolicy);
  const paymentPolicy = settings.get("payment.policy") ?? {};
  const launchPolicyRaw = settings.get("launch.policy") ?? {};
  const paymentProviders = Array.isArray(paymentPolicy.paymentProviders)
    ? paymentPolicy.paymentProviders.filter((provider): provider is string => typeof provider === "string")
    : [];
  const launchPaymentsEnabled = launchPolicyRaw.paymentsEnabled === true;
  const paymentEnabled = paymentPolicy.enabled === true || launchPaymentsEnabled;
  const paymentProvider = paymentProviders[0] ?? null;
  const paymentMode = paymentEnabled
    ? paymentProvider === "sandbox"
      ? "sandbox"
      : "production"
    : "disabled";

  const launchPolicy = {
    globalFreeMode: launchPolicyRaw.globalFreeMode !== false,
    globalPaidMode: launchPolicyRaw.globalPaidMode === true,
    discountMode: launchPolicyRaw.discountMode === true,
    countryPricing: launchPolicyRaw.countryPricing === true,
    categoryPricing: launchPolicyRaw.categoryPricing === true,
    firstAdFree: launchPolicyRaw.firstAdFree !== false,
    freeAdsPerUser:
      typeof launchPolicyRaw.freeAdsPerUser === "number" ? launchPolicyRaw.freeAdsPerUser : null,
    couponSystem: launchPolicyRaw.couponSystem === true,
    paymentRequired: launchPolicyRaw.paymentRequired === true,
    paymentsEnabled: launchPaymentsEnabled,
    taxEnabled: launchPolicyRaw.taxEnabled === true,
    featuredAdsEnabled: launchPolicyRaw.featuredAdsEnabled !== false,
    topBannerEnabled: launchPolicyRaw.topBannerEnabled !== false,
    allCountriesVisibility: launchPolicyRaw.allCountriesVisibility !== false,
    instantPublishing: launchPolicyRaw.instantPublishing !== false,
    aiModeration: launchPolicyRaw.aiModeration !== false,
    manualPreApproval: launchPolicyRaw.manualPreApproval === true,
    postPublishReports: launchPolicyRaw.postPublishReports !== false,
    defaultFeedMarket:
      typeof launchPolicyRaw.defaultFeedMarket === "string"
        ? launchPolicyRaw.defaultFeedMarket
        : "ALL",
    pricingMode:
      launchPolicyRaw.pricingMode === "paid" || launchPolicyRaw.pricingMode === "discount"
        ? launchPolicyRaw.pricingMode
        : "free",
    bannerMessageAr:
      typeof launchPolicyRaw.bannerMessageAr === "string"
        ? launchPolicyRaw.bannerMessageAr
        : "النشر مجاني حاليًا بمناسبة إطلاق إعلاني.",
    bannerMessageEn:
      typeof launchPolicyRaw.bannerMessageEn === "string"
        ? launchPolicyRaw.bannerMessageEn
        : "Publishing is free right now for the E3lani launch.",
  };

  return {
    appName: "إعلاني | E3lani",
    currency: pricingVersion.currency,
    pricingVersion: pricingVersion.version,
    effectiveFrom: pricingVersion.effectiveFrom,
    finalBasePriceHalalas: pricingVersion.basePriceHalalas,
    vatBasisPoints: pricingVersion.vatBasisPoints,
    activeDurationDays: requireNumber(adsPolicy.defaultActiveDays, "ads.policy.defaultActiveDays"),
    republishCooldownHours: requireNumber(adsPolicy.republishCooldownHours, "ads.policy.republishCooldownHours"),
    mediaPolicy,
    paymentEnabled,
    paymentMode,
    paymentProvider,
    paymentDisclaimer:
      paymentMode === "disabled"
        ? "Payment is disabled. Free global publishing remains available."
        : "Payment requires server-side provider verification before activating distribution.",
    launchPolicy,
    pricingRules: ruleRows,
    promotions: promotionRows,
  };
}

export type AuthClientType = "web" | "native";

export async function createAuthSession(input: {
  userId: number;
  tokenId: string;
  clientType: AuthClientType;
  userAgentHash: string | null;
  ipHash: string | null;
  expiresAt: Date;
}) {
  const db = requireDatabase(await getDb());
  await db.insert(authSessions).values({
    userId: input.userId,
    tokenId: input.tokenId,
    clientType: input.clientType,
    userAgentHash: input.userAgentHash,
    ipHash: input.ipHash,
    expiresAt: input.expiresAt,
  });
}

export async function getAuthSession(tokenId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db.select().from(authSessions).where(eq(authSessions.tokenId, tokenId)).limit(1);
  return rows[0] ?? null;
}

export async function touchAuthSession(tokenId: string) {
  const db = requireDatabase(await getDb());
  await db.update(authSessions).set({ lastSeenAt: new Date() }).where(eq(authSessions.tokenId, tokenId));
}

export async function revokeAuthSession(tokenId: string) {
  const db = requireDatabase(await getDb());
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.tokenId, tokenId), isNull(authSessions.revokedAt)));
}

export async function revokeAllAuthSessions(userId: number, exceptTokenId?: string | null) {
  const db = requireDatabase(await getDb());
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
        exceptTokenId ? ne(authSessions.tokenId, exceptTokenId) : undefined,
      ),
    );
}

export async function listActiveAuthSessions(userId: number) {
  const db = requireDatabase(await getDb());
  return db
    .select({
      id: authSessions.id,
      tokenId: authSessions.tokenId,
      clientType: authSessions.clientType,
      createdAt: authSessions.createdAt,
      lastSeenAt: authSessions.lastSeenAt,
      expiresAt: authSessions.expiresAt,
    })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(authSessions.lastSeenAt));
}

export type AuthRateLimitPolicy = {
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
};

export async function checkAuthRateLimit(scope: string, keyHash: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(authRateLimits)
    .where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.keyHash, keyHash)))
    .limit(1);
  const record = rows[0];
  if (!record?.blockedUntil || record.blockedUntil.getTime() <= Date.now()) {
    return { allowed: true, retryAfterSeconds: 0 } as const;
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((record.blockedUntil.getTime() - Date.now()) / 1000)),
  } as const;
}

export async function recordAuthFailure(
  scope: string,
  keyHash: string,
  policy: AuthRateLimitPolicy,
) {
  const db = requireDatabase(await getDb());
  const now = new Date();
  const rows = await db
    .select()
    .from(authRateLimits)
    .where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.keyHash, keyHash)))
    .limit(1);
  const record = rows[0];

  if (!record) {
    await db.insert(authRateLimits).values({
      scope,
      keyHash,
      attempts: 1,
      windowStartedAt: now,
    });
    return;
  }

  const windowExpired = now.getTime() - record.windowStartedAt.getTime() >= policy.windowMs;
  const attempts = windowExpired ? 1 : record.attempts + 1;
  const blockedUntil = attempts >= policy.maxAttempts ? new Date(now.getTime() + policy.blockMs) : null;
  await db
    .update(authRateLimits)
    .set({
      attempts,
      windowStartedAt: windowExpired ? now : record.windowStartedAt,
      blockedUntil,
    })
    .where(eq(authRateLimits.id, record.id));
}

export async function clearAuthRateLimit(scope: string, keyHash: string) {
  const db = requireDatabase(await getDb());
  await db
    .delete(authRateLimits)
    .where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.keyHash, keyHash)));
}

export async function getPublicMediaPolicy() {
  const database = requireDatabase(await getDb());
  const [mediaRows, adsRows] = await Promise.all([
    database
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(and(eq(appSettings.settingKey, "media.policy"), eq(appSettings.isPublic, 1)))
      .limit(1),
    database
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(and(eq(appSettings.settingKey, "ads.policy"), eq(appSettings.isPublic, 1)))
      .limit(1),
  ]);
  return normalizeMediaPolicy(mediaRows[0]?.value, adsRows[0]?.value);
}

export async function upsertAppSetting(input: {
  settingKey: string;
  value: Record<string, unknown>;
  isPublic?: number;
  updatedBy?: number | null;
}) {
  const database = requireDatabase(await getDb());
  const existing = await database
    .select({ id: appSettings.id })
    .from(appSettings)
    .where(eq(appSettings.settingKey, input.settingKey))
    .limit(1);

  if (existing[0]) {
    await database
      .update(appSettings)
      .set({
        value: input.value,
        isPublic: input.isPublic ?? 1,
        updatedBy: input.updatedBy ?? null,
      })
      .where(eq(appSettings.id, existing[0].id));
  } else {
    await database.insert(appSettings).values({
      settingKey: input.settingKey,
      value: input.value,
      isPublic: input.isPublic ?? 1,
      updatedBy: input.updatedBy ?? null,
    });
  }

  return { ok: true as const, settingKey: input.settingKey };
}

export async function updateLaunchPolicy(
  patch: Record<string, unknown>,
  updatedBy?: number | null,
) {
  const database = requireDatabase(await getDb());
  const rows = await database
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.settingKey, "launch.policy"))
    .limit(1);
  const current = asObject(rows[0]?.value ?? {});
  const next = { ...current, ...patch };
  await upsertAppSetting({
    settingKey: "launch.policy",
    value: next,
    isPublic: 1,
    updatedBy,
  });
  return getPublicProductConfig();
}

export async function getOwnedMediaAssetByStorageKey(ownerId: number, storageKey: string) {
  const database = requireDatabase(await getDb());
  const rows = await database
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerId, ownerId), eq(mediaAssets.storageKey, storageKey)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOwnedMediaAsset(ownerId: number, mediaAssetId: number) {
  const database = requireDatabase(await getDb());
  const rows = await database
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerId, ownerId), eq(mediaAssets.id, mediaAssetId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createMediaAsset(input: typeof mediaAssets.$inferInsert) {
  const database = requireDatabase(await getDb());
  try {
    await database.insert(mediaAssets).values(input);
  } catch (error) {
    const existing = await getOwnedMediaAssetByStorageKey(input.ownerId, input.storageKey);
    if (existing) return existing;
    throw error;
  }
  const created = await getOwnedMediaAssetByStorageKey(input.ownerId, input.storageKey);
  if (!created) throw new Error("MEDIA_DATABASE_WRITE_FAILED");
  return created;
}

export async function listOwnedMediaAssets(ownerId: number, limit = 50) {
  const database = requireDatabase(await getDb());
  return database
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.ownerId, ownerId))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function attachMediaAssetToRevision(input: {
  ownerId: number;
  revisionId: number;
  mediaAssetId: number;
  sortOrder?: number;
  altTextAr?: string | null;
  altTextEn?: string | null;
}) {
  const database = requireDatabase(await getDb());
  const policy = await getPublicMediaPolicy();
  return database.transaction(async (transaction) => {
    const revisionRows = await transaction
      .select({ revisionId: adRevisions.id, adId: ads.id })
      .from(adRevisions)
      .innerJoin(ads, eq(adRevisions.adId, ads.id))
      .where(and(eq(adRevisions.id, input.revisionId), eq(ads.ownerId, input.ownerId)))
      .limit(1)
      .for("update");
    const assetRows = await transaction
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, input.mediaAssetId), eq(mediaAssets.ownerId, input.ownerId)))
      .limit(1);
    const revision = revisionRows[0];
    const asset = assetRows[0];
    if (!revision) throw new Error("MEDIA_REVISION_NOT_FOUND");
    if (!asset || asset.processingStatus !== "ready") throw new Error("MEDIA_ASSET_NOT_READY");

    const existing = await transaction
      .select({
        id: adMedia.id,
        mediaAssetId: adMedia.mediaAssetId,
        sortOrder: adMedia.sortOrder,
        mediaType: mediaAssets.mediaType,
      })
      .from(adMedia)
      .innerJoin(mediaAssets, eq(adMedia.mediaAssetId, mediaAssets.id))
      .where(eq(adMedia.revisionId, input.revisionId))
      .orderBy(asc(adMedia.sortOrder));
    const duplicate = existing.find((item) => item.mediaAssetId === input.mediaAssetId);
    if (duplicate) return duplicate;

    const imageCount = existing.filter((item) => item.mediaType === "image").length;
    const videoCount = existing.filter((item) => item.mediaType === "video").length;
    if ((asset.mediaType === "image" && videoCount > 0) || (asset.mediaType === "video" && imageCount > 0)) {
      throw new Error("MEDIA_MIXED_TYPES_NOT_ALLOWED");
    }
    if (asset.mediaType === "image" && imageCount >= policy.maxImages) {
      throw new Error("MEDIA_IMAGE_COUNT_EXCEEDED");
    }
    if (asset.mediaType === "video" && videoCount >= policy.maxVideos) {
      throw new Error("MEDIA_VIDEO_COUNT_EXCEEDED");
    }

    const sortOrder = input.sortOrder ?? (existing.at(-1)?.sortOrder ?? -1) + 1;
    await transaction.insert(adMedia).values({
      revisionId: input.revisionId,
      mediaAssetId: input.mediaAssetId,
      sortOrder,
      altTextAr: input.altTextAr ?? null,
      altTextEn: input.altTextEn ?? null,
    });
    await transaction
      .update(ads)
      .set({ mediaStatus: "ready" })
      .where(eq(ads.id, revision.adId));

    const rows = await transaction
      .select()
      .from(adMedia)
      .where(and(eq(adMedia.revisionId, input.revisionId), eq(adMedia.mediaAssetId, input.mediaAssetId)))
      .limit(1);
    return rows[0];
  });
}

export async function listRevisionMediaForOwner(ownerId: number, revisionId: number) {
  const database = requireDatabase(await getDb());
  const ownership = await database
    .select({ id: adRevisions.id })
    .from(adRevisions)
    .innerJoin(ads, eq(adRevisions.adId, ads.id))
    .where(and(eq(adRevisions.id, revisionId), eq(ads.ownerId, ownerId)))
    .limit(1);
  if (!ownership[0]) throw new Error("MEDIA_REVISION_NOT_FOUND");

  return database
    .select({
      id: adMedia.id,
      revisionId: adMedia.revisionId,
      sortOrder: adMedia.sortOrder,
      altTextAr: adMedia.altTextAr,
      altTextEn: adMedia.altTextEn,
      asset: mediaAssets,
    })
    .from(adMedia)
    .innerJoin(mediaAssets, eq(adMedia.mediaAssetId, mediaAssets.id))
    .where(eq(adMedia.revisionId, revisionId))
    .orderBy(asc(adMedia.sortOrder));
}

export async function detachMediaFromRevision(ownerId: number, adMediaId: number) {
  const database = requireDatabase(await getDb());
  const rows = await database
    .select({ id: adMedia.id, adId: ads.id })
    .from(adMedia)
    .innerJoin(adRevisions, eq(adMedia.revisionId, adRevisions.id))
    .innerJoin(ads, eq(adRevisions.adId, ads.id))
    .where(and(eq(adMedia.id, adMediaId), eq(ads.ownerId, ownerId)))
    .limit(1);
  if (!rows[0]) throw new Error("MEDIA_LINK_NOT_FOUND");
  await database.delete(adMedia).where(eq(adMedia.id, adMediaId));

  const remaining = await database
    .select({ id: adMedia.id })
    .from(adMedia)
    .innerJoin(adRevisions, eq(adMedia.revisionId, adRevisions.id))
    .where(eq(adRevisions.adId, rows[0].adId))
    .limit(1);
  if (!remaining[0]) {
    await database.update(ads).set({ mediaStatus: "empty" }).where(eq(ads.id, rows[0].adId));
  }
  return { success: true } as const;
}

export async function deleteOwnedMediaAsset(ownerId: number, mediaAssetId: number) {
  const database = requireDatabase(await getDb());
  const asset = await getOwnedMediaAsset(ownerId, mediaAssetId);
  if (!asset) throw new Error("MEDIA_ASSET_NOT_FOUND");
  const links = await database
    .select({ id: adMedia.id })
    .from(adMedia)
    .where(eq(adMedia.mediaAssetId, mediaAssetId))
    .limit(1);
  if (links[0]) throw new Error("MEDIA_ASSET_IN_USE");
  await database
    .delete(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaAssetId), eq(mediaAssets.ownerId, ownerId)));
  return { success: true } as const;
}
