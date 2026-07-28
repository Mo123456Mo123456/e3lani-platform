import { and, desc, eq, isNull, ne, or } from "drizzle-orm";

import {
  ads,
  businessProfiles,
  userProfiles,
  users,
} from "../drizzle/schema";
import { getAdByPublicId } from "./core-data";
import { getDb } from "./db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type AdvertiserProfileInput = {
  displayName: string;
  slug: string;
  bio?: string;
  websiteUrl?: string;
  logoUrl?: string;
  coverUrl?: string;
};

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "account",
  "advertiser",
  "brand",
  "create-ad",
  "e3lani",
  "login",
  "moderation",
  "support",
]);

function requireDatabase(database: Awaited<ReturnType<typeof getDb>>): Database {
  if (!database) throw new Error("DATABASE_UNAVAILABLE");
  return database;
}

export function normalizeAdvertiserSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function validateSlug(value: string) {
  const normalized = normalizeAdvertiserSlug(value);
  if (normalized.length < 3 || normalized.length > 120) {
    throw new Error("ADVERTISER_SLUG_INVALID");
  }
  if (RESERVED_SLUGS.has(normalized)) {
    throw new Error("ADVERTISER_SLUG_RESERVED");
  }
  return normalized;
}

function optionalUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("ADVERTISER_URL_INVALID");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("ADVERTISER_URL_INVALID");
  }
  return parsed.toString();
}

async function activePostsForOwner(database: Database, ownerId: number, limit = 50) {
  const rows = await database
    .select({ publicId: ads.publicId })
    .from(ads)
    .where(and(eq(ads.ownerId, ownerId), eq(ads.adStatus, "active"), isNull(ads.deletedAt)))
    .orderBy(desc(ads.activatedAt), desc(ads.createdAt))
    .limit(limit);

  const posts = await Promise.all(rows.map((row) => getAdByPublicId(row.publicId)));
  return posts.filter((post): post is NonNullable<typeof post> => Boolean(post));
}

async function profileRow(database: Database, userId: number) {
  const rows = await database
    .select({
      userId: users.id,
      accountName: users.name,
      accountType: users.accountType,
      status: users.status,
      displayName: businessProfiles.displayName,
      slug: businessProfiles.slug,
      logoUrl: businessProfiles.logoUrl,
      coverUrl: businessProfiles.coverUrl,
      websiteUrl: businessProfiles.websiteUrl,
      verificationStatus: businessProfiles.verificationStatus,
      verifiedAt: businessProfiles.verifiedAt,
      bio: userProfiles.bio,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
    .where(and(eq(users.id, userId), eq(users.status, "active"), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMyAdvertiserProfile(userId: number) {
  const database = requireDatabase(await getDb());
  const [profile, posts] = await Promise.all([
    profileRow(database, userId),
    activePostsForOwner(database, userId),
  ]);
  if (!profile) throw new Error("USER_NOT_FOUND");

  return {
    userId: profile.userId,
    displayName: profile.displayName ?? profile.accountName ?? "",
    slug: profile.slug,
    bio: profile.bio ?? "",
    logoUrl: profile.logoUrl,
    coverUrl: profile.coverUrl,
    websiteUrl: profile.websiteUrl,
    verificationStatus: profile.verificationStatus ?? "unverified",
    verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    accountType: profile.accountType,
    posts,
    stats: {
      activePosts: posts.length,
      totalViews: posts.reduce((total, post) => total + post.metrics.views, 0),
      totalSaves: posts.reduce((total, post) => total + post.metrics.saves, 0),
    },
  };
}

export async function upsertAdvertiserProfile(userId: number, input: AdvertiserProfileInput) {
  const database = requireDatabase(await getDb());
  const displayName = input.displayName.trim();
  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error("ADVERTISER_NAME_INVALID");
  }
  const slug = validateSlug(input.slug);
  const bio = input.bio?.trim() || null;
  if (bio && bio.length > 1000) throw new Error("ADVERTISER_BIO_TOO_LONG");
  const websiteUrl = optionalUrl(input.websiteUrl);
  const logoUrl = optionalUrl(input.logoUrl);
  const coverUrl = optionalUrl(input.coverUrl);

  const duplicate = await database
    .select({ userId: businessProfiles.userId })
    .from(businessProfiles)
    .where(and(eq(businessProfiles.slug, slug), ne(businessProfiles.userId, userId)))
    .limit(1);
  if (duplicate[0]) throw new Error("ADVERTISER_SLUG_TAKEN");

  await database.transaction(async (tx) => {
    await tx
      .insert(userProfiles)
      .values({ userId, displayName, bio })
      .onDuplicateKeyUpdate({ set: { displayName, bio } });

    await tx
      .insert(businessProfiles)
      .values({
        userId,
        slug,
        displayName,
        websiteUrl,
        logoUrl,
        coverUrl,
      })
      .onDuplicateKeyUpdate({
        set: {
          slug,
          displayName,
          websiteUrl,
          logoUrl,
          coverUrl,
        },
      });

    await tx
      .update(users)
      .set({
        name: displayName,
        accountType: "advertiser",
      })
      .where(and(eq(users.id, userId), or(eq(users.accountType, "viewer"), eq(users.accountType, "advertiser"))));
  });

  return getMyAdvertiserProfile(userId);
}

export async function getPublicAdvertiserProfile(slugInput: string) {
  const database = requireDatabase(await getDb());
  const slug = normalizeAdvertiserSlug(slugInput);
  if (!slug) return null;

  const rows = await database
    .select({
      userId: users.id,
      displayName: businessProfiles.displayName,
      slug: businessProfiles.slug,
      logoUrl: businessProfiles.logoUrl,
      coverUrl: businessProfiles.coverUrl,
      websiteUrl: businessProfiles.websiteUrl,
      verificationStatus: businessProfiles.verificationStatus,
      verifiedAt: businessProfiles.verifiedAt,
      bio: userProfiles.bio,
    })
    .from(businessProfiles)
    .innerJoin(users, eq(users.id, businessProfiles.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(businessProfiles.slug, slug),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  const profile = rows[0];
  if (!profile) return null;

  const posts = await activePostsForOwner(database, profile.userId);
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    slug: profile.slug,
    bio: profile.bio ?? "",
    logoUrl: profile.logoUrl,
    coverUrl: profile.coverUrl,
    websiteUrl: profile.websiteUrl,
    verificationStatus: profile.verificationStatus,
    verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    posts,
    stats: {
      activePosts: posts.length,
      totalViews: posts.reduce((total, post) => total + post.metrics.views, 0),
      totalSaves: posts.reduce((total, post) => total + post.metrics.saves, 0),
    },
  };
}
