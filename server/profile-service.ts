import { randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";

import {
  advertiserProfiles,
  ads,
  identityActionEvents,
  mediaAssets,
  moderationCases,
  profileFollows,
  profilePostMedia,
  profilePosts,
  reports,
  users,
} from "../drizzle/schema";
import { scanAdContent } from "../lib/moderation/ai-scan";
import {
  enforceRollingLimit,
  findIdempotentAction,
  identityInsert,
  lockIdentity,
  recordIdentityAction,
  type ContentIdentity,
} from "./content-identity";
import { getDb, requireDatabase } from "./db";
import { loadLaunchPolicy } from "./pricing-service";

function publicId(prefix: string, max = 32): string {
  return `${prefix}_${randomBytes(10).toString("hex")}`.slice(0, max);
}

function identityCondition(
  identity: ContentIdentity,
  userColumn: typeof advertiserProfiles.userId | typeof profilePosts.ownerId,
  visitorColumn:
    | typeof advertiserProfiles.visitorSessionId
    | typeof profilePosts.ownerVisitorSessionId,
) {
  return identity.kind === "user"
    ? eq(userColumn as never, identity.userId)
    : eq(visitorColumn as never, identity.visitorSessionId);
}

function normalizeUsername(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{3,30}$/.test(normalized)) throw new Error("USERNAME_INVALID");
  return normalized;
}

function safeHttpsUrl(value: string | null | undefined, allowedHosts?: string[]): string | null {
  if (!value?.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("PROFILE_URL_INVALID");
  }
  if (parsed.protocol !== "https:") throw new Error("PROFILE_URL_INVALID");
  const hostname = parsed.hostname.toLowerCase();
  if (
    allowedHosts?.length &&
    !allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  ) {
    throw new Error("PROFILE_URL_HOST_INVALID");
  }
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return parsed.toString().slice(0, 1024);
}

function safeWhatsAppUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  if (/^\+?\d[\d\s()-]{7,20}$/.test(value.trim())) {
    return `https://wa.me/${value.replace(/\D/g, "")}`;
  }
  return safeHttpsUrl(value, ["wa.me", "whatsapp.com"]);
}

async function ensureAdvertiserProfileInTx(tx: any, identity: ContentIdentity) {
  const rows = await tx
    .select()
    .from(advertiserProfiles)
    .where(
      identityCondition(
        identity,
        advertiserProfiles.userId,
        advertiserProfiles.visitorSessionId,
      ),
    )
    .limit(1);
  if (rows[0]) {
    if (rows[0].status !== "active") throw new Error("ADVERTISER_PROFILE_SUSPENDED");
    return rows[0];
  }

  let displayName = "معلن إعلاني";
  if (identity.kind === "user") {
    const userRows = await tx
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1);
    displayName = userRows[0]?.name?.trim() || displayName;
  }
  const suffix = randomBytes(5).toString("hex");
  const username = identity.kind === "user" ? `advertiser_${identity.userId}_${suffix}` : `guest_${suffix}`;
  const inserted = await tx.insert(advertiserProfiles).values({
    publicId: publicId("profile"),
    ...identityInsert(identity),
    username,
    displayName,
    status: "active",
  });
  const created = await tx
    .select()
    .from(advertiserProfiles)
    .where(eq(advertiserProfiles.id, Number(inserted[0].insertId)))
    .limit(1);
  if (!created[0]) throw new Error("ADVERTISER_PROFILE_CREATE_FAILED");
  return created[0];
}

export async function ensureAdvertiserProfile(identity: ContentIdentity) {
  const db = requireDatabase(await getDb());
  return db.transaction(async (tx) => {
    await lockIdentity(tx, identity);
    return ensureAdvertiserProfileInTx(tx, identity);
  });
}

async function profileStats(profileId: number) {
  const db = requireDatabase(await getDb());
  const [postRows, adRows, followerRows] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`,
        views: sql<number>`coalesce(sum(${profilePosts.views}), 0)`,
      })
      .from(profilePosts)
      .where(
        and(
          eq(profilePosts.advertiserProfileId, profileId),
          eq(profilePosts.postStatus, "active"),
          isNull(profilePosts.deletedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ads)
      .where(
        and(
          eq(ads.advertiserProfileId, profileId),
          eq(ads.adStatus, "active"),
          isNull(ads.deletedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(profileFollows)
      .where(eq(profileFollows.advertiserProfileId, profileId)),
  ]);
  return {
    posts: Number(postRows[0]?.count ?? 0),
    ads: Number(adRows[0]?.count ?? 0),
    views: Number(postRows[0]?.views ?? 0),
    followers: Number(followerRows[0]?.count ?? 0),
  };
}

function isProfileOwner(profile: typeof advertiserProfiles.$inferSelect, identity?: ContentIdentity | null) {
  if (!identity) return false;
  return identity.kind === "user"
    ? profile.userId === identity.userId
    : profile.visitorSessionId === identity.visitorSessionId;
}

async function profileDto(
  profile: typeof advertiserProfiles.$inferSelect,
  identity?: ContentIdentity | null,
) {
  const stats = await profileStats(profile.id);
  return {
    id: profile.publicId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    bio: profile.bio,
    isVerified: profile.isVerified === 1,
    socialLinks: {
      tiktok: profile.tiktokUrl,
      snapchat: profile.snapchatUrl,
      instagram: profile.instagramUrl,
      whatsapp: profile.whatsappUrl,
      website: profile.websiteUrl,
      store: profile.storeUrl,
    },
    stats,
    isOwner: isProfileOwner(profile, identity),
  };
}

export async function getAdvertiserProfileByUsername(
  username: string,
  identity?: ContentIdentity | null,
) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(advertiserProfiles)
    .where(
      and(
        eq(advertiserProfiles.username, normalizeUsername(username)),
        eq(advertiserProfiles.status, "active"),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error("ADVERTISER_PROFILE_NOT_FOUND");
  return profileDto(rows[0], identity);
}

export async function getOwnAdvertiserProfile(identity: ContentIdentity) {
  const profile = await ensureAdvertiserProfile(identity);
  return profileDto(profile, identity);
}

export async function updateAdvertiserProfile(
  identity: ContentIdentity,
  input: {
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    bio?: string | null;
    tiktokUrl?: string | null;
    snapchatUrl?: string | null;
    instagramUrl?: string | null;
    whatsappUrl?: string | null;
    websiteUrl?: string | null;
    storeUrl?: string | null;
  },
) {
  const db = requireDatabase(await getDb());
  const profile = await ensureAdvertiserProfile(identity);
  const values = {
    ...(input.username !== undefined ? { username: normalizeUsername(input.username) } : {}),
    ...(input.displayName !== undefined
      ? { displayName: input.displayName.trim().slice(0, 120) }
      : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: safeHttpsUrl(input.avatarUrl) } : {}),
    ...(input.coverUrl !== undefined ? { coverUrl: safeHttpsUrl(input.coverUrl) } : {}),
    ...(input.bio !== undefined ? { bio: input.bio?.trim().slice(0, 280) || null } : {}),
    ...(input.tiktokUrl !== undefined
      ? { tiktokUrl: safeHttpsUrl(input.tiktokUrl, ["tiktok.com"]) }
      : {}),
    ...(input.snapchatUrl !== undefined
      ? { snapchatUrl: safeHttpsUrl(input.snapchatUrl, ["snapchat.com"]) }
      : {}),
    ...(input.instagramUrl !== undefined
      ? { instagramUrl: safeHttpsUrl(input.instagramUrl, ["instagram.com"]) }
      : {}),
    ...(input.whatsappUrl !== undefined
      ? { whatsappUrl: safeWhatsAppUrl(input.whatsappUrl) }
      : {}),
    ...(input.websiteUrl !== undefined ? { websiteUrl: safeHttpsUrl(input.websiteUrl) } : {}),
    ...(input.storeUrl !== undefined ? { storeUrl: safeHttpsUrl(input.storeUrl) } : {}),
  };
  if ("displayName" in values && !values.displayName) throw new Error("DISPLAY_NAME_REQUIRED");
  await db.update(advertiserProfiles).set(values).where(eq(advertiserProfiles.id, profile.id));
  const updated = await db
    .select()
    .from(advertiserProfiles)
    .where(eq(advertiserProfiles.id, profile.id))
    .limit(1);
  return profileDto(updated[0], identity);
}

export type ProfilePostDto = {
  id: string;
  profileId: string;
  username: string;
  displayName: string;
  title: string;
  description: string;
  status: string;
  moderationStatus: string;
  media: Array<{ id: number; kind: "image" | "video"; uri: string; mediaAssetId: number }>;
  views: number;
  shares: number;
  createdAt: string;
  isOwner: boolean;
};

async function mapPosts(
  postRows: Array<typeof profilePosts.$inferSelect>,
  identity?: ContentIdentity | null,
): Promise<ProfilePostDto[]> {
  if (!postRows.length) return [];
  const db = requireDatabase(await getDb());
  const postIds = postRows.map((post) => post.id);
  const profileIds = [...new Set(postRows.map((post) => post.advertiserProfileId))];
  const [mediaRows, profiles] = await Promise.all([
    db
      .select({
        postId: profilePostMedia.profilePostId,
        id: profilePostMedia.id,
        sortOrder: profilePostMedia.sortOrder,
        mediaAssetId: mediaAssets.id,
        kind: mediaAssets.mediaType,
        uri: mediaAssets.originalUrl,
      })
      .from(profilePostMedia)
      .innerJoin(mediaAssets, eq(profilePostMedia.mediaAssetId, mediaAssets.id))
      .where(inArray(profilePostMedia.profilePostId, postIds))
      .orderBy(asc(profilePostMedia.sortOrder)),
    db
      .select()
      .from(advertiserProfiles)
      .where(inArray(advertiserProfiles.id, profileIds)),
  ]);
  return postRows.map((post) => {
    const profile = profiles.find((value) => value.id === post.advertiserProfileId)!;
    return {
      id: post.publicId,
      profileId: profile.publicId,
      username: profile.username,
      displayName: profile.displayName,
      title: post.title,
      description: post.description,
      status: post.postStatus,
      moderationStatus: post.moderationStatus,
      media: mediaRows
        .filter((media) => media.postId === post.id)
        .map((media) => ({
          id: media.id,
          kind: media.kind,
          uri: media.uri,
          mediaAssetId: media.mediaAssetId,
        })),
      views: post.views,
      shares: post.shares,
      createdAt: post.createdAt.toISOString(),
      isOwner:
        Boolean(identity) &&
        (identity!.kind === "user"
          ? post.ownerId === identity!.userId
          : post.ownerVisitorSessionId === identity!.visitorSessionId),
    };
  });
}

export async function listProfilePosts(username: string, identity?: ContentIdentity | null) {
  const db = requireDatabase(await getDb());
  const profile = await db
    .select()
    .from(advertiserProfiles)
    .where(
      and(
        eq(advertiserProfiles.username, normalizeUsername(username)),
        eq(advertiserProfiles.status, "active"),
      ),
    )
    .limit(1);
  if (!profile[0]) throw new Error("ADVERTISER_PROFILE_NOT_FOUND");
  const rows = await db
    .select()
    .from(profilePosts)
    .where(
      and(
        eq(profilePosts.advertiserProfileId, profile[0].id),
        eq(profilePosts.postStatus, "active"),
        isNull(profilePosts.deletedAt),
      ),
    )
    .orderBy(desc(profilePosts.createdAt))
    .limit(100);
  return mapPosts(rows, identity);
}

export async function getProfilePost(publicPostId: string, identity?: ContentIdentity | null) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(profilePosts)
    .where(and(eq(profilePosts.publicId, publicPostId), isNull(profilePosts.deletedAt)))
    .limit(1);
  if (!rows[0]) throw new Error("PROFILE_POST_NOT_FOUND");
  const owner =
    Boolean(identity) &&
    (identity!.kind === "user"
      ? rows[0].ownerId === identity!.userId
      : rows[0].ownerVisitorSessionId === identity!.visitorSessionId);
  if (rows[0].postStatus !== "active" && !owner) throw new Error("PROFILE_POST_NOT_FOUND");
  return (await mapPosts(rows, identity))[0];
}

export async function listOwnProfilePosts(identity: ContentIdentity) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(profilePosts)
    .where(and(identityCondition(identity, profilePosts.ownerId, profilePosts.ownerVisitorSessionId), isNull(profilePosts.deletedAt)))
    .orderBy(desc(profilePosts.createdAt))
    .limit(100);
  return mapPosts(rows, identity);
}

function ownedMediaCondition(identity: ContentIdentity) {
  return identity.kind === "user"
    ? eq(mediaAssets.ownerId, identity.userId)
    : eq(mediaAssets.ownerVisitorSessionId, identity.visitorSessionId);
}

export async function createProfilePost(input: {
  identity: ContentIdentity;
  idempotencyKey: string;
  title: string;
  description: string;
  mediaAssetIds: number[];
}) {
  const db = requireDatabase(await getDb());
  const policy = await loadLaunchPolicy();
  if (input.identity.kind === "visitor") {
    if (policy.authenticationRequired || !policy.guestPublishingEnabled) {
      throw new Error("GUEST_PUBLISHING_DISABLED");
    }
    if (policy.verificationRequiredForPublishing) throw new Error("PUBLISHING_VERIFICATION_REQUIRED");
  }
  const postPublicId = publicId("post");
  const scan = policy.aiModeration
    ? scanAdContent({ title: input.title, description: input.description })
    : { autoAction: "keep_published" as const, reasons: [], confidence: 0, label: "SAFE" as const };

  const resultId = await db.transaction(async (tx) => {
    await lockIdentity(tx, input.identity);
    const duplicate = await findIdempotentAction(tx, input.idempotencyKey, "profile_post");
    if (duplicate) return duplicate;
    await enforceRollingLimit(tx, {
      identity: input.identity,
      actionType: "profile_post",
      limit: policy.profilePostsDailyLimit,
    });
    const profile = await ensureAdvertiserProfileInTx(tx, input.identity);
    const ownedMedia = await tx
      .select()
      .from(mediaAssets)
      .where(and(inArray(mediaAssets.id, input.mediaAssetIds), ownedMediaCondition(input.identity)));
    if (ownedMedia.length !== input.mediaAssetIds.length) throw new Error("MEDIA_ASSET_NOT_FOUND");
    if (ownedMedia.some((media: typeof mediaAssets.$inferSelect) => media.processingStatus !== "ready")) {
      throw new Error("MEDIA_ASSET_NOT_READY");
    }

    const severe = scan.autoAction === "auto_pause";
    const inserted = await tx.insert(profilePosts).values({
      publicId: postPublicId,
      advertiserProfileId: profile.id,
      ownerId: input.identity.userId,
      ownerVisitorSessionId: input.identity.visitorSessionId,
      title: input.title.trim().slice(0, 160),
      description: input.description.trim(),
      postStatus: severe ? "paused" : "active",
      moderationStatus: severe ? "rejected" : scan.autoAction === "flag_for_admin" ? "queued" : "approved",
    });
    const postId = Number(inserted[0].insertId);
    for (const [index, mediaAssetId] of input.mediaAssetIds.entries()) {
      await tx.insert(profilePostMedia).values({ profilePostId: postId, mediaAssetId, sortOrder: index });
    }
    if (scan.autoAction !== "keep_published") {
      await tx.insert(moderationCases).values({
        profilePostId: postId,
        status: severe ? "rejected" : "queued",
        riskScore: Math.round(scan.confidence * 100),
        automatedSignals: scan,
        decisionReason: scan.reasons.join(", ") || null,
        decidedAt: severe ? new Date() : null,
      });
    }
    await recordIdentityAction(tx, {
      identity: input.identity,
      actionType: "profile_post",
      contentPublicId: postPublicId,
      idempotencyKey: input.idempotencyKey,
    });
    return postPublicId;
  });

  const rows = await db
    .select()
    .from(profilePosts)
    .where(eq(profilePosts.publicId, resultId))
    .limit(1);
  const mapped = await mapPosts(rows, input.identity);
  if (!mapped[0]) throw new Error("PROFILE_POST_CREATE_FAILED");
  return mapped[0];
}

async function requireOwnedPost(identity: ContentIdentity, publicPostId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(profilePosts)
    .where(
      and(
        eq(profilePosts.publicId, publicPostId),
        identityCondition(identity, profilePosts.ownerId, profilePosts.ownerVisitorSessionId),
        isNull(profilePosts.deletedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error("PROFILE_POST_NOT_FOUND");
  return rows[0];
}

export async function getPostConversionDraft(identity: ContentIdentity, publicPostId: string) {
  const policy = await loadLaunchPolicy();
  if (!policy.postToAdEnabled) throw new Error("POST_TO_AD_DISABLED");
  const post = await requireOwnedPost(identity, publicPostId);
  const mapped = await mapPosts([post], identity);
  return mapped[0];
}

export async function updateProfilePost(
  identity: ContentIdentity,
  input: { id: string; title?: string; description?: string },
) {
  const db = requireDatabase(await getDb());
  const post = await requireOwnedPost(identity, input.id);
  await db
    .update(profilePosts)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim().slice(0, 160) } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    })
    .where(eq(profilePosts.id, post.id));
  const rows = await db.select().from(profilePosts).where(eq(profilePosts.id, post.id)).limit(1);
  return (await mapPosts(rows, identity))[0];
}

export async function deleteProfilePost(identity: ContentIdentity, publicPostId: string) {
  const db = requireDatabase(await getDb());
  const post = await requireOwnedPost(identity, publicPostId);
  await db
    .update(profilePosts)
    .set({ postStatus: "removed", deletedAt: new Date() })
    .where(eq(profilePosts.id, post.id));
  return { ok: true as const };
}

export async function recordProfilePostEvent(
  publicPostId: string,
  eventType: "view" | "share",
) {
  const db = requireDatabase(await getDb());
  const column = eventType === "view" ? profilePosts.views : profilePosts.shares;
  await db
    .update(profilePosts)
    .set({ [eventType === "view" ? "views" : "shares"]: sql`${column} + 1` })
    .where(and(eq(profilePosts.publicId, publicPostId), eq(profilePosts.postStatus, "active")));
  return { ok: true as const };
}

export async function reportProfilePost(input: {
  identity: ContentIdentity;
  publicPostId: string;
  idempotencyKey: string;
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
  const post = await db
    .select({ id: profilePosts.id })
    .from(profilePosts)
    .where(
      and(
        eq(profilePosts.publicId, input.publicPostId),
        eq(profilePosts.postStatus, "active"),
        isNull(profilePosts.deletedAt),
      ),
    )
    .limit(1);
  if (!post[0]) throw new Error("PROFILE_POST_NOT_FOUND");
  const reportPublicId = publicId("rep");
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
      profilePostId: post[0].id,
      reason: input.reason,
      details: input.details?.trim().slice(0, 2000) ?? null,
      status: "open",
    });
    const open = await tx
      .select({ id: moderationCases.id })
      .from(moderationCases)
      .where(
        and(
          eq(moderationCases.profilePostId, post[0].id),
          inArray(moderationCases.status, ["queued", "in_review", "appealed"]),
        ),
      )
      .limit(1);
    if (!open[0]) {
      await tx.insert(moderationCases).values({
        profilePostId: post[0].id,
        status: "queued",
        riskScore: input.reason === "weapons" || input.reason === "drugs" || input.reason === "sexual" ? 85 : 50,
        automatedSignals: { source: "user_report", reason: input.reason },
      });
    }
    await recordIdentityAction(tx, {
      identity: input.identity,
      actionType: "report",
      contentPublicId: reportPublicId,
      idempotencyKey: input.idempotencyKey,
    });
    return reportPublicId;
  });
  return { ok: true as const };
}

export async function toggleProfileFollow(identity: ContentIdentity, username: string) {
  const db = requireDatabase(await getDb());
  const profile = await db
    .select({ id: advertiserProfiles.id })
    .from(advertiserProfiles)
    .where(
      and(
        eq(advertiserProfiles.username, normalizeUsername(username)),
        eq(advertiserProfiles.status, "active"),
      ),
    )
    .limit(1);
  if (!profile[0]) throw new Error("ADVERTISER_PROFILE_NOT_FOUND");
  const condition =
    identity.kind === "user"
      ? eq(profileFollows.userId, identity.userId)
      : eq(profileFollows.visitorSessionId, identity.visitorSessionId);
  const existing = await db
    .select({ id: profileFollows.id })
    .from(profileFollows)
    .where(and(eq(profileFollows.advertiserProfileId, profile[0].id), condition))
    .limit(1);
  if (existing[0]) {
    await db.delete(profileFollows).where(eq(profileFollows.id, existing[0].id));
    return { following: false as const };
  }
  await db.insert(profileFollows).values({
    advertiserProfileId: profile[0].id,
    ...identityInsert(identity),
  });
  return { following: true as const };
}

