import type { Ad } from "@/lib/e3lani-data";

export type FeedMode = "forYou" | "nearby" | "latest";

export type FeedCity = {
  id: string;
  region?: string;
  countryCode?: string;
};

export type RankOptions = {
  mode: FeedMode;
  marketCode: string;
  categoryId?: string;
  cities?: FeedCity[];
  metrics?: Record<string, { views?: number; saves?: number; shares?: number }>;
  blockedOwners?: string[];
};

function countryForCity(cityId: string, cities: FeedCity[] = []): string | undefined {
  const city = cities.find((item) => item.id === cityId);
  if (!city) return undefined;
  if (city.countryCode) return city.countryCode;
  // Seed/catalog cities currently use region ids like "central"; treat SA as default market.
  return "SA";
}

/** Score used by «لك» — featured/promoted first, then engagement, then freshness. */
export function forYouScore(
  ad: Ad,
  metrics: RankOptions["metrics"] = {},
  nowMs = Date.now(),
): number {
  const views = metrics[ad.id]?.views ?? 0;
  const saves = metrics[ad.id]?.saves ?? 0;
  const shares = metrics[ad.id]?.shares ?? 0;
  const ageHours = Math.max(0, (nowMs - new Date(ad.createdAt).getTime()) / 3_600_000);
  const freshness = Math.max(0, 48 - ageHours) / 48;
  return (
    (ad.featured ? 1 : 0) +
    (ad.sponsored ? 0.45 : 0) +
    views / 100_000 +
    saves / 10_000 +
    shares / 10_000 +
    freshness * 0.2
  );
}

/**
 * Builds the home feed with distinct logic per tab.
 * Tabs must not collapse into a single cosmetic reorder.
 */
export function rankFeedAds(ads: Ad[], options: RankOptions): Ad[] {
  const blocked = new Set(options.blockedOwners ?? []);
  let list = ads.filter(
    (ad) => ad.status === "active" && !blocked.has(ad.ownerId),
  );

  if (options.categoryId) {
    list = list.filter((ad) => ad.categoryId === options.categoryId);
  }

  if (options.mode === "nearby") {
    list = list.filter((ad) => {
      const country = countryForCity(ad.cityId, options.cities);
      // When city→country mapping is incomplete, keep city-level proximity via market cities.
      if (country) return country === options.marketCode;
      return Boolean(
        options.cities?.some(
          (city) => city.id === ad.cityId && (city.countryCode ?? "SA") === options.marketCode,
        ),
      );
    });
  }

  if (options.mode === "latest") {
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (options.mode === "nearby") {
    return [...list].sort((a, b) => {
      const score =
        forYouScore(b, options.metrics) - forYouScore(a, options.metrics);
      if (score !== 0) return score;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  // forYou: diversity soft-cap — avoid more than 2 consecutive same-owner ads.
  const ranked = [...list].sort(
    (a, b) => forYouScore(b, options.metrics) - forYouScore(a, options.metrics),
  );
  return diversifyByOwner(ranked, 2);
}

function diversifyByOwner(ads: Ad[], maxStreak: number): Ad[] {
  const remaining = [...ads];
  const result: Ad[] = [];
  let streakOwner = "";
  let streak = 0;

  while (remaining.length) {
    let index = remaining.findIndex((ad) => {
      if (streakOwner !== ad.ownerId) return true;
      return streak < maxStreak;
    });
    if (index < 0) index = 0;
    const [next] = remaining.splice(index, 1);
    if (!next) break;
    if (next.ownerId === streakOwner) streak += 1;
    else {
      streakOwner = next.ownerId;
      streak = 1;
    }
    result.push(next);
  }

  return result;
}

export const MARKETS = [
  {
    code: "SA",
    nameAr: "السعودية",
    nameEn: "Saudi Arabia",
    cityIds: ["riyadh", "jeddah", "makkah", "madinah", "dammam", "abha", "jazan", "tabuk"],
  },
  {
    code: "AE",
    nameAr: "الإمارات",
    nameEn: "United Arab Emirates",
    cityIds: ["dubai", "abu_dhabi", "sharjah", "ajman", "ras_al_khaimah"],
  },
  {
    code: "EG",
    nameAr: "مصر",
    nameEn: "Egypt",
    cityIds: ["cairo", "giza", "alexandria", "mansoura", "aswan"],
  },
] as const;

export type MarketCode = (typeof MARKETS)[number]["code"];

export function getMarket(code: string) {
  return MARKETS.find((item) => item.code === code) ?? MARKETS[0];
}
