import type { Ad, Metrics } from "./e3lani-data";

export type FeedMode = "forYou" | "near" | "latest";

export type FeedContext = {
  mode: FeedMode;
  /** City ids belonging to the selected market (for «قريب منك»). */
  marketCityIds?: string[];
  preferredCityId?: string;
  preferredCategoryIds?: string[];
  metrics?: Record<string, Metrics>;
  categoryFilter?: string;
  blockedOwners?: string[];
};

/** Score used by the For You tab: featured, sponsored, engagement, and local affinity. */
export function scoreForYouAd(
  ad: Ad,
  context: Pick<FeedContext, "preferredCityId" | "preferredCategoryIds" | "metrics">,
): number {
  const metrics = context.metrics?.[ad.id];
  const views = metrics?.views ?? 0;
  const saves = metrics?.saves ?? 0;
  const shares = metrics?.shares ?? 0;
  const contacts = metrics?.contacts ?? 0;
  const cityBoost = context.preferredCityId && ad.cityId === context.preferredCityId ? 0.35 : 0;
  const categoryBoost = context.preferredCategoryIds?.includes(ad.categoryId) ? 0.25 : 0;
  return (
    (ad.featured ? 1 : 0) +
    (ad.sponsored ? 0.45 : 0) +
    views / 100000 +
    saves / 5000 +
    shares / 8000 +
    contacts / 4000 +
    cityBoost +
    categoryBoost
  );
}

/** Rank active ads for a feed tab without collapsing modes into one sort. */
export function rankFeedAds(ads: Ad[], context: FeedContext): Ad[] {
  const blocked = new Set(context.blockedOwners ?? []);
  let items = ads.filter((ad) => ad.status === "active" && !blocked.has(ad.ownerId));

  if (context.categoryFilter) {
    items = items.filter((ad) => ad.categoryId === context.categoryFilter);
  }

  if (context.mode === "near") {
    const market = new Set(context.marketCityIds ?? []);
    if (market.size > 0) {
      items = items.filter((ad) => market.has(ad.cityId));
    } else if (context.preferredCityId) {
      items = items.filter((ad) => ad.cityId === context.preferredCityId);
    }
    return [...items].sort((a, b) => {
      const aLocal = context.preferredCityId && a.cityId === context.preferredCityId ? 1 : 0;
      const bLocal = context.preferredCityId && b.cityId === context.preferredCityId ? 1 : 0;
      if (bLocal !== aLocal) return bLocal - aLocal;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  if (context.mode === "latest") {
    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const scored = [...items].sort(
    (a, b) => scoreForYouAd(b, context) - scoreForYouAd(a, context),
  );
  return diversifyByCategory(scored);
}

function diversifyByCategory(ads: Ad[]): Ad[] {
  if (ads.length < 3) return ads;
  const result: Ad[] = [];
  const deferred: Ad[] = [];

  for (const ad of ads) {
    const previous = result[result.length - 1];
    if (previous && previous.categoryId === ad.categoryId) {
      deferred.push(ad);
      continue;
    }
    result.push(ad);
    if (deferred.length) {
      const next = deferred.shift();
      if (next) result.push(next);
    }
  }
  return result.concat(deferred);
}

export const REPORT_REASONS_AR = [
  "محتوى مضلل",
  "منتج ممنوع",
  "احتيال",
  "رابط ضار",
  "انتحال",
  "محتوى غير مناسب",
  "إعلان مكرر",
  "مخالفة سياسة الدولة",
  "سبب آخر",
] as const;

export const TICKER_LOGOS = ["نَخبة", "URBAN", "رِواق", "VIA", "SAND", "تِقنية", "رؤية", "LUMA"] as const;
