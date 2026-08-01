import { and, eq, isNull } from "drizzle-orm";

import { ads, favorites, visitorSessions } from "../drizzle/schema";
import { getDb, requireDatabase } from "./db";

export type VisitorPrefs = {
  accountCountry?: string;
  marketCode?: string;
  forceCountryFilter?: boolean;
  categoryFilter?: string;
  countryGateCompleted?: boolean;
};

export async function upsertVisitorSession(input: {
  anonymousId: string;
  prefs: VisitorPrefs;
  savedAdPublicIds?: string[];
}) {
  const database = await getDb();
  if (!database) return { ok: true as const, merged: false as const, skipped: true as const };
  const db = requireDatabase(database);
  const anonymousId = input.anonymousId.trim().slice(0, 128);
  if (!anonymousId) throw new Error("ANONYMOUS_ID_REQUIRED");

  const existing = await db
    .select({ id: visitorSessions.id, mergedUserId: visitorSessions.mergedUserId })
    .from(visitorSessions)
    .where(eq(visitorSessions.anonymousId, anonymousId))
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

  await db.insert(visitorSessions).values({
    anonymousId,
    prefsJson: input.prefs,
    savedAdPublicIds: input.savedAdPublicIds ?? null,
  });
  return { ok: true as const, merged: false as const };
}

/** Merge anonymous prefs/favorites into a logged-in user after OTP verify. */
export async function mergeVisitorIntoUser(input: {
  anonymousId?: string | null;
  userId: number;
}) {
  const anonymousId = input.anonymousId?.trim();
  if (!anonymousId) return { merged: false as const, favoritesAdded: 0 };

  const database = await getDb();
  if (!database) return { merged: false as const, favoritesAdded: 0, skipped: true as const };
  const db = requireDatabase(database);
  const rows = await db
    .select()
    .from(visitorSessions)
    .where(and(eq(visitorSessions.anonymousId, anonymousId), isNull(visitorSessions.mergedUserId)))
    .limit(1);
  if (!rows[0]) return { merged: false as const, favoritesAdded: 0 };

  const savedIds = Array.isArray(rows[0].savedAdPublicIds) ? rows[0].savedAdPublicIds : [];
  let favoritesAdded = 0;

  for (const publicId of savedIds) {
    const adRows = await db
      .select({ id: ads.id })
      .from(ads)
      .where(eq(ads.publicId, publicId))
      .limit(1);
    if (!adRows[0]) continue;
    const existing = await db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.userId, input.userId), eq(favorites.adId, adRows[0].id)))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(favorites).values({ userId: input.userId, adId: adRows[0].id });
    favoritesAdded += 1;
  }

  await db
    .update(visitorSessions)
    .set({ mergedUserId: input.userId, mergedAt: new Date() })
    .where(eq(visitorSessions.id, rows[0].id));

  return {
    merged: true as const,
    favoritesAdded,
    prefs: rows[0].prefsJson as VisitorPrefs,
  };
}
