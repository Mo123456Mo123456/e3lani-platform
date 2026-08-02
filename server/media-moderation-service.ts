import { and, eq, inArray } from "drizzle-orm";

import {
  adMedia,
  adRevisions,
  ads,
  mediaAssets,
  moderationCases,
  profilePostMedia,
  profilePosts,
} from "../drizzle/schema";
import { getDb, requireDatabase } from "./db";
import { storageGetSignedUrl } from "./storage";

type ProviderDecision = {
  decision: "safe" | "review" | "block" | "not_configured" | "failed";
  confidence: number;
  reasons: string[];
};

async function providerDecision(
  assets: { storageKey: string; mediaType: "image" | "video"; mimeType: string }[],
): Promise<ProviderDecision> {
  const providerUrl = process.env.MODERATION_PROVIDER_URL?.trim();
  const apiKey = process.env.MODERATION_PROVIDER_API_KEY?.trim();
  if (!providerUrl || !apiKey) {
    return { decision: "not_configured", confidence: 0, reasons: [] };
  }
  const urls = await Promise.all(
    assets.map(async (asset) => ({
      type: asset.mediaType,
      mimeType: asset.mimeType,
      url: await storageGetSignedUrl(asset.storageKey),
    })),
  );
  try {
    const response = await fetch(providerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assets: urls }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return { decision: "failed", confidence: 0, reasons: [] };
    const payload = (await response.json()) as Record<string, unknown>;
    const decision =
      payload.decision === "safe" || payload.decision === "review" || payload.decision === "block"
        ? payload.decision
        : "failed";
    const confidence =
      typeof payload.confidence === "number"
        ? Math.min(1, Math.max(0, payload.confidence))
        : 0;
    const reasons = Array.isArray(payload.reasons)
      ? payload.reasons.filter((reason): reason is string => typeof reason === "string").slice(0, 20)
      : [];
    return { decision, confidence, reasons };
  } catch {
    return { decision: "failed", confidence: 0, reasons: [] };
  }
}

export async function moderateAdMediaAfterPublish(publicAdId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({
      adId: ads.id,
      revisionId: adRevisions.id,
      storageKey: mediaAssets.storageKey,
      mediaType: mediaAssets.mediaType,
      mimeType: mediaAssets.mimeType,
    })
    .from(ads)
    .innerJoin(adRevisions, eq(ads.currentRevisionId, adRevisions.id))
    .innerJoin(adMedia, eq(adMedia.revisionId, adRevisions.id))
    .innerJoin(mediaAssets, eq(adMedia.mediaAssetId, mediaAssets.id))
    .where(eq(ads.publicId, publicAdId));
  if (!rows.length) return { decision: "safe" as const, configured: true };
  const scan = await providerDecision(rows);
  if (scan.decision === "not_configured") return { decision: scan.decision, configured: false };
  if (scan.decision === "failed") {
    const open = await db
      .select({ id: moderationCases.id })
      .from(moderationCases)
      .where(
        and(
          eq(moderationCases.adId, rows[0].adId),
          inArray(moderationCases.status, ["queued", "in_review"]),
        ),
      )
      .limit(1);
    if (!open[0]) {
      await db.insert(moderationCases).values({
        adId: rows[0].adId,
        revisionId: rows[0].revisionId,
        status: "queued",
        riskScore: 25,
        automatedSignals: { source: "media_provider", result: scan.decision },
        decisionReason: "media_scan_failed",
      });
    }
    await db.update(ads).set({ moderationStatus: "queued" }).where(eq(ads.id, rows[0].adId));
    return { decision: scan.decision, configured: true };
  }
  if (scan.decision === "review" || scan.decision === "block") {
    await db.insert(moderationCases).values({
      adId: rows[0].adId,
      revisionId: rows[0].revisionId,
      status: scan.decision === "block" ? "rejected" : "queued",
      riskScore: Math.round(scan.confidence * 100),
      automatedSignals: { source: "media_provider", ...scan },
      decisionReason: scan.reasons.join(", ") || null,
      decidedAt: scan.decision === "block" ? new Date() : null,
    });
    await db
      .update(ads)
      .set({
        adStatus: scan.decision === "block" ? "paused" : "active",
        moderationStatus: scan.decision === "block" ? "rejected" : "queued",
        pausedAt: scan.decision === "block" ? new Date() : null,
      })
      .where(eq(ads.id, rows[0].adId));
  }
  return { decision: scan.decision, configured: true };
}

export async function moderateProfilePostMediaAfterPublish(publicPostId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({
      postId: profilePosts.id,
      storageKey: mediaAssets.storageKey,
      mediaType: mediaAssets.mediaType,
      mimeType: mediaAssets.mimeType,
    })
    .from(profilePosts)
    .innerJoin(profilePostMedia, eq(profilePostMedia.profilePostId, profilePosts.id))
    .innerJoin(mediaAssets, eq(profilePostMedia.mediaAssetId, mediaAssets.id))
    .where(eq(profilePosts.publicId, publicPostId));
  if (!rows.length) return { decision: "safe" as const, configured: true };
  const scan = await providerDecision(rows);
  if (scan.decision === "not_configured") return { decision: scan.decision, configured: false };
  if (scan.decision === "failed" || scan.decision === "review" || scan.decision === "block") {
    await db.insert(moderationCases).values({
      profilePostId: rows[0].postId,
      status: scan.decision === "block" ? "rejected" : "queued",
      riskScore: scan.decision === "failed" ? 25 : Math.round(scan.confidence * 100),
      automatedSignals: { source: "media_provider", ...scan },
      decisionReason:
        scan.decision === "failed" ? "media_scan_failed" : scan.reasons.join(", ") || null,
      decidedAt: scan.decision === "block" ? new Date() : null,
    });
    await db
      .update(profilePosts)
      .set({
        postStatus: scan.decision === "block" ? "paused" : "active",
        moderationStatus: scan.decision === "block" ? "rejected" : "queued",
      })
      .where(eq(profilePosts.id, rows[0].postId));
  }
  return { decision: scan.decision, configured: true };
}

