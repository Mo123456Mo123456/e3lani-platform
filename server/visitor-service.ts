import { and, eq, isNull } from "drizzle-orm";

import {
  adRevisions,
  advertiserProfiles,
  ads,
  favorites,
  identityActionEvents,
  mediaAssets,
  profileFollows,
  profilePosts,
  reports,
  shareMediaVariants,
  visitorSessions,
} from "../drizzle/schema";
import type { AuthenticatedVisitor } from "./visitor-token";
import { getDb, requireDatabase } from "./db";

export type VisitorPrefs = {
  accountCountry?: string;
  marketCode?: string;
  forceCountryFilter?: boolean;
  categoryFilter?: string;
  countryGateCompleted?: boolean;
  blockedOwners?: string[];
};

export async function upsertVisitorSession(input: {
  visitor: AuthenticatedVisitor;
  prefs: VisitorPrefs;
  savedAdPublicIds?: string[];
}) {
  const database = await getDb();
  if (!database) return { ok: true as const, merged: false as const, skipped: true as const };
  const db = requireDatabase(database);
  const existing = await db
    .select({ id: visitorSessions.id, mergedUserId: visitorSessions.mergedUserId })
    .from(visitorSessions)
    .where(eq(visitorSessions.id, input.visitor.id))
    .limit(1);

  if (existing[0]) {
    if (existing[0].mergedUserId) {
      return { ok: true as const, merged: true as const };
    }
    await db
      .update(visitorSessions)
      .set({
        prefsJson: input.prefs,
        savedAdPublicIds: input.savedAdPublicIds ?? null,
      })
      .where(eq(visitorSessions.id, existing[0].id));
    return { ok: true as const, merged: false as const };
  }

  throw new Error("VISITOR_NOT_FOUND");
}

/** Atomically transfer all guest-owned data into the verified account. */
export async function mergeVisitorIntoUser(input: {
  visitor?: AuthenticatedVisitor | null;
  userId: number;
}) {
  if (!input.visitor) return { merged: false as const, favoritesAdded: 0 };

  const database = await getDb();
  if (!database) return { merged: false as const, favoritesAdded: 0, skipped: true as const };
  const db = requireDatabase(database);
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(visitorSessions)
      .where(
        and(
          eq(visitorSessions.id, input.visitor!.id),
          isNull(visitorSessions.mergedUserId),
          eq(visitorSessions.status, "active"),
        ),
      )
      .limit(1)
      .for("update");
    if (!rows[0]) return { merged: false as const, favoritesAdded: 0 };

    const legacySavedIds = Array.isArray(rows[0].savedAdPublicIds)
      ? rows[0].savedAdPublicIds
      : [];
    let favoritesAdded = 0;
    for (const publicAdId of legacySavedIds) {
      const ad = await tx
        .select({ id: ads.id })
        .from(ads)
        .where(eq(ads.publicId, publicAdId))
        .limit(1);
      if (!ad[0]) continue;
      const duplicate = await tx
        .select({ id: favorites.id })
        .from(favorites)
        .where(and(eq(favorites.userId, input.userId), eq(favorites.adId, ad[0].id)))
        .limit(1);
      if (!duplicate[0]) {
        await tx.insert(favorites).values({ userId: input.userId, adId: ad[0].id });
        favoritesAdded += 1;
      }
    }

    const guestFavorites = await tx
      .select({ id: favorites.id, adId: favorites.adId })
      .from(favorites)
      .where(eq(favorites.visitorSessionId, input.visitor!.id));
    for (const favorite of guestFavorites) {
      const duplicate = await tx
        .select({ id: favorites.id })
        .from(favorites)
        .where(and(eq(favorites.userId, input.userId), eq(favorites.adId, favorite.adId)))
        .limit(1);
      if (duplicate[0]) {
        await tx.delete(favorites).where(eq(favorites.id, favorite.id));
      } else {
        await tx
          .update(favorites)
          .set({ userId: input.userId, visitorSessionId: null })
          .where(eq(favorites.id, favorite.id));
        favoritesAdded += 1;
      }
    }

    const guestProfile = await tx
      .select()
      .from(advertiserProfiles)
      .where(eq(advertiserProfiles.visitorSessionId, input.visitor!.id))
      .limit(1);
    const accountProfile = await tx
      .select()
      .from(advertiserProfiles)
      .where(eq(advertiserProfiles.userId, input.userId))
      .limit(1);

    if (guestProfile[0] && accountProfile[0]) {
      await tx
        .update(ads)
        .set({ advertiserProfileId: accountProfile[0].id })
        .where(eq(ads.advertiserProfileId, guestProfile[0].id));
      await tx
        .update(profilePosts)
        .set({ advertiserProfileId: accountProfile[0].id })
        .where(eq(profilePosts.advertiserProfileId, guestProfile[0].id));
      await tx.delete(advertiserProfiles).where(eq(advertiserProfiles.id, guestProfile[0].id));
    } else if (guestProfile[0]) {
      await tx
        .update(advertiserProfiles)
        .set({ userId: input.userId, visitorSessionId: null })
        .where(eq(advertiserProfiles.id, guestProfile[0].id));
    }

    await tx
      .update(mediaAssets)
      .set({ ownerId: input.userId, ownerVisitorSessionId: null })
      .where(eq(mediaAssets.ownerVisitorSessionId, input.visitor!.id));
    await tx
      .update(ads)
      .set({ ownerId: input.userId, ownerVisitorSessionId: null })
      .where(eq(ads.ownerVisitorSessionId, input.visitor!.id));
    await tx
      .update(adRevisions)
      .set({ createdBy: input.userId, createdByVisitorSessionId: null })
      .where(eq(adRevisions.createdByVisitorSessionId, input.visitor!.id));
    await tx
      .update(profilePosts)
      .set({ ownerId: input.userId, ownerVisitorSessionId: null })
      .where(eq(profilePosts.ownerVisitorSessionId, input.visitor!.id));
    await tx
      .update(identityActionEvents)
      .set({ userId: input.userId, visitorSessionId: null })
      .where(eq(identityActionEvents.visitorSessionId, input.visitor!.id));
    await tx
      .update(reports)
      .set({ reporterId: input.userId, reporterVisitorSessionId: null })
      .where(eq(reports.reporterVisitorSessionId, input.visitor!.id));
    await tx
      .update(shareMediaVariants)
      .set({ requestedByUserId: input.userId, requestedByVisitorSessionId: null })
      .where(eq(shareMediaVariants.requestedByVisitorSessionId, input.visitor!.id));

    const guestFollows = await tx
      .select()
      .from(profileFollows)
      .where(eq(profileFollows.visitorSessionId, input.visitor!.id));
    for (const follow of guestFollows) {
      const duplicate = await tx
        .select({ id: profileFollows.id })
        .from(profileFollows)
        .where(
          and(
            eq(profileFollows.advertiserProfileId, follow.advertiserProfileId),
            eq(profileFollows.userId, input.userId),
          ),
        )
        .limit(1);
      if (duplicate[0]) {
        await tx.delete(profileFollows).where(eq(profileFollows.id, follow.id));
      } else {
        await tx
          .update(profileFollows)
          .set({ userId: input.userId, visitorSessionId: null })
          .where(eq(profileFollows.id, follow.id));
      }
    }

    await tx
      .update(visitorSessions)
      .set({
        mergedUserId: input.userId,
        mergedAt: new Date(),
        status: "merged",
        tokenVersion: rows[0].tokenVersion + 1,
      })
      .where(eq(visitorSessions.id, rows[0].id));

    return {
      merged: true as const,
      favoritesAdded,
      prefs: rows[0].prefsJson as VisitorPrefs,
    };
  });
}
