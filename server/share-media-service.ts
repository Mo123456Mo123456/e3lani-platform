import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";

import {
  adMedia,
  adRevisions,
  advertiserProfiles,
  ads,
  mediaAssets,
  shareMediaVariants,
} from "../drizzle/schema";
import type { ContentIdentity } from "./content-identity";
import { getDb, requireDatabase } from "./db";
import { loadLaunchPolicy } from "./pricing-service";
import { storageGetSignedUrl, storagePut } from "./storage";
import { createWatermarkedShareVideo } from "./video-processing";

const SHARE_VARIANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function publicId() {
  return `share_${randomBytes(10).toString("hex")}`.slice(0, 32);
}

function requesterCondition(identity: ContentIdentity) {
  return identity.kind === "user"
    ? eq(shareMediaVariants.requestedByUserId, identity.userId)
    : eq(shareMediaVariants.requestedByVisitorSessionId, identity.visitorSessionId);
}

function requesterValues(identity: ContentIdentity) {
  return identity.kind === "user"
    ? { requestedByUserId: identity.userId, requestedByVisitorSessionId: null }
    : { requestedByUserId: null, requestedByVisitorSessionId: identity.visitorSessionId };
}

async function getSourceVideo(publicAdId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({
      adId: ads.id,
      adStatus: ads.adStatus,
      sourceMediaAssetId: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      mediaType: mediaAssets.mediaType,
      username: advertiserProfiles.username,
    })
    .from(ads)
    .innerJoin(adRevisions, eq(ads.currentRevisionId, adRevisions.id))
    .innerJoin(adMedia, eq(adMedia.revisionId, adRevisions.id))
    .innerJoin(mediaAssets, eq(adMedia.mediaAssetId, mediaAssets.id))
    .leftJoin(advertiserProfiles, eq(ads.advertiserProfileId, advertiserProfiles.id))
    .where(
      and(
        eq(ads.publicId, publicAdId),
        eq(mediaAssets.mediaType, "video"),
        isNull(ads.deletedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error("SHARE_VIDEO_NOT_FOUND");
  if (rows[0].adStatus !== "active") throw new Error("SHARE_AD_NOT_ACTIVE");
  return rows[0];
}

function result(row: typeof shareMediaVariants.$inferSelect) {
  return {
    id: row.publicId,
    status: row.status,
    url: row.status === "ready" ? `/share/media/${row.publicId}` : null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    retryAvailable: row.status === "failed",
    error: row.status === "failed" ? row.failureReason : null,
  };
}

async function processVariant(variantId: number) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({
      variant: shareMediaVariants,
      storageKey: mediaAssets.storageKey,
    })
    .from(shareMediaVariants)
    .innerJoin(mediaAssets, eq(shareMediaVariants.sourceMediaAssetId, mediaAssets.id))
    .where(eq(shareMediaVariants.id, variantId))
    .limit(1);
  if (!rows[0]) throw new Error("SHARE_VARIANT_NOT_FOUND");
  const row = rows[0];
  try {
    const signedSource = await storageGetSignedUrl(row.storageKey);
    const response = await fetch(signedSource);
    if (!response.ok) throw new Error("SHARE_SOURCE_DOWNLOAD_FAILED");
    const source = Buffer.from(await response.arrayBuffer());
    const output = await createWatermarkedShareVideo(source, row.variant.watermarkText);
    const stored = await storagePut(
      `media/share/${row.variant.publicId}/watermarked.mp4`,
      output,
      "video/mp4",
    );
    const expiresAt = new Date(Date.now() + SHARE_VARIANT_TTL_MS);
    await db
      .update(shareMediaVariants)
      .set({
        status: "ready",
        storageKey: stored.key,
        url: `/share/media/${row.variant.publicId}`,
        mimeType: "video/mp4",
        bytes: output.length,
        expiresAt,
        failureReason: null,
      })
      .where(eq(shareMediaVariants.id, variantId));
  } catch {
    await db
      .update(shareMediaVariants)
      .set({
        status: "failed",
        failureReason: "VIDEO_WATERMARK_PROCESSING_FAILED",
      })
      .where(eq(shareMediaVariants.id, variantId));
  }
  const updated = await db
    .select()
    .from(shareMediaVariants)
    .where(eq(shareMediaVariants.id, variantId))
    .limit(1);
  if (!updated[0]) throw new Error("SHARE_VARIANT_NOT_FOUND");
  return result(updated[0]);
}

export async function createVideoShareVariant(input: {
  identity: ContentIdentity;
  publicAdId: string;
  idempotencyKey: string;
}) {
  const db = requireDatabase(await getDb());
  const policy = await loadLaunchPolicy();
  const source = await getSourceVideo(input.publicAdId);
  if (!policy.watermarkEnabled) {
    return {
      id: null,
      status: "ready" as const,
      url: `/manus-storage/${source.storageKey}`,
      expiresAt: null,
      retryAvailable: false,
      error: null,
    };
  }
  const existing = await db
    .select()
    .from(shareMediaVariants)
    .where(
      and(
        eq(shareMediaVariants.idempotencyKey, input.idempotencyKey),
        requesterCondition(input.identity),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].status === "processing") throw new Error("SHARE_VARIANT_PROCESSING");
    return result(existing[0]);
  }

  const variantPublicId = publicId();
  const inserted = await db.insert(shareMediaVariants).values({
    publicId: variantPublicId,
    adId: source.adId,
    sourceMediaAssetId: source.sourceMediaAssetId,
    ...requesterValues(input.identity),
    status: "processing",
    watermarkText: `${policy.watermarkText}\n@${source.username ?? "e3lani"}`,
    idempotencyKey: input.idempotencyKey,
  });
  return processVariant(Number(inserted[0].insertId));
}

export async function retryVideoShareVariant(identity: ContentIdentity, variantPublicId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(shareMediaVariants)
    .where(
      and(
        eq(shareMediaVariants.publicId, variantPublicId),
        requesterCondition(identity),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error("SHARE_VARIANT_NOT_FOUND");
  if (rows[0].status === "ready") return result(rows[0]);
  if (rows[0].status === "processing") throw new Error("SHARE_VARIANT_PROCESSING");
  await db
    .update(shareMediaVariants)
    .set({ status: "processing", failureReason: null })
    .where(eq(shareMediaVariants.id, rows[0].id));
  return processVariant(rows[0].id);
}

export async function getReadyShareVariant(publicIdValue: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(shareMediaVariants)
    .where(
      and(
        eq(shareMediaVariants.publicId, publicIdValue),
        eq(shareMediaVariants.status, "ready"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.storageKey || !row.expiresAt || row.expiresAt <= new Date()) return null;
  return row;
}

export async function cleanupExpiredShareVariants(limit = 200) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ id: shareMediaVariants.id })
    .from(shareMediaVariants)
    .where(lt(shareMediaVariants.expiresAt, new Date()))
    .limit(Math.min(Math.max(limit, 1), 1000));
  if (rows.length) {
    await db
      .delete(shareMediaVariants)
      .where(inArray(shareMediaVariants.id, rows.map((row) => row.id)));
  }
  return { deletedRecords: rows.length };
}

