import type { Ad } from "../e3lani-data";
import { ACCOUNT_COUNTRIES } from "../countries";

export type FeedMode = "forYou" | "nearby" | "latest";

export type FeedCity = {
  id: string;
  region?: string;
  countryCode?: string;
};

export type RankOptions = {
  mode: FeedMode;
  /** `ALL` = global feed. A country code filters only when `forceCountryFilter` or nearby. */
  marketCode: string;
  categoryId?: string;
  cities?: FeedCity[];
  metrics?: Record<string, { views?: number; saves?: number; shares?: number }>;
  blockedOwners?: string[];
  /** When false, country may hide ads (legacy). Default true for open launch. */
  allCountriesVisibility?: boolean;
  /** User explicitly chose a country chip (not merely account country). */
  forceCountryFilter?: boolean;
};

export const GLOBAL_MARKET = "ALL" as const;

function countryForAd(ad: Ad, cities: FeedCity[] = []): string | undefined {
  if (ad.countryCode) return ad.countryCode;
  const city = cities.find((item) => item.id === ad.cityId);
  return city?.countryCode;
}

/** Score used by «لك» — quality, engagement, freshness; country is a soft boost only. */
export function forYouScore(
  ad: Ad,
  metrics: RankOptions["metrics"] = {},
  preferredCountry?: string,
  nowMs = Date.now(),
): number {
  const views = metrics[ad.id]?.views ?? 0;
  const saves = metrics[ad.id]?.saves ?? 0;
  const shares = metrics[ad.id]?.shares ?? 0;
  const ageHours = Math.max(0, (nowMs - new Date(ad.createdAt).getTime()) / 3_600_000);
  const freshness = Math.max(0, 48 - ageHours) / 48;
  const countryBoost =
    preferredCountry && preferredCountry !== GLOBAL_MARKET && ad.countryCode === preferredCountry
      ? 0.15
      : 0;
  return (
    (ad.featured ? 1 : 0) +
    (ad.sponsored ? 0.45 : 0) +
    views / 100_000 +
    saves / 10_000 +
    shares / 10_000 +
    freshness * 0.2 +
    countryBoost
  );
}

/**
 * Builds the home feed with distinct logic per tab.
 * Country never blocks visibility unless the user explicitly filters (or nearby mode).
 */
export function rankFeedAds(ads: Ad[], options: RankOptions): Ad[] {
  const blocked = new Set(options.blockedOwners ?? []);
  const globalVisible = options.allCountriesVisibility !== false;
  let list = ads.filter((ad) => ad.status === "active" && !blocked.has(ad.ownerId));

  if (options.categoryId) {
    list = list.filter((ad) => ad.categoryId === options.categoryId);
  }

  const market = options.marketCode || GLOBAL_MARKET;
  const applyCountryFilter =
    market !== GLOBAL_MARKET &&
    (options.mode === "nearby" ||
      options.forceCountryFilter === true ||
      options.allCountriesVisibility === false);

  if (applyCountryFilter) {
    list = list.filter((ad) => countryForAd(ad, options.cities) === market);
  }

  // Keep type used so unused-flag lint stays quiet when visibility is global.
  void globalVisible;

  if (options.mode === "latest") {
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (options.mode === "nearby") {
    return [...list].sort((a, b) => {
      const score =
        forYouScore(b, options.metrics, market) - forYouScore(a, options.metrics, market);
      if (score !== 0) return score;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  const preferred = market === GLOBAL_MARKET ? undefined : market;
  const ranked = [...list].sort(
    (a, b) =>
      forYouScore(b, options.metrics, preferred) - forYouScore(a, options.metrics, preferred),
  );
  return diversifyFeed(ranked, 2, 3);
}

function diversifyFeed(ads: Ad[], maxOwnerStreak: number, maxCountryStreak: number): Ad[] {
  const remaining = [...ads];
  const result: Ad[] = [];
  let streakOwner = "";
  let ownerStreak = 0;
  let streakCountry = "";
  let countryStreak = 0;

  while (remaining.length) {
    let index = remaining.findIndex((ad) => {
      const ownerOk = streakOwner !== ad.ownerId || ownerStreak < maxOwnerStreak;
      const countryOk =
        !ad.countryCode ||
        streakCountry !== ad.countryCode ||
        countryStreak < maxCountryStreak;
      return ownerOk && countryOk;
    });
    if (index < 0) index = 0;
    const [next] = remaining.splice(index, 1);
    if (!next) break;
    if (next.ownerId === streakOwner) ownerStreak += 1;
    else {
      streakOwner = next.ownerId;
      ownerStreak = 1;
    }
    if (next.countryCode && next.countryCode === streakCountry) countryStreak += 1;
    else {
      streakCountry = next.countryCode ?? "";
      countryStreak = 1;
    }
    result.push(next);
  }

  return result;
}

const CITY_IDS: Record<string, string[]> = {
  SA: ["riyadh", "jeddah", "makkah", "madinah", "dammam", "abha", "jazan", "tabuk"],
  AE: ["dubai", "abu_dhabi", "sharjah", "ajman", "ras_al_khaimah"],
  EG: ["cairo", "giza", "alexandria", "mansoura", "aswan"],
};

export const MARKETS = [
  {
    code: GLOBAL_MARKET,
    nameAr: "جميع الدول",
    nameEn: "All countries",
    flag: "🌍",
    cityIds: [] as string[],
  },
  ...ACCOUNT_COUNTRIES.map((country) => ({
    code: country.code,
    nameAr: country.nameAr,
    nameEn: country.nameEn,
    flag: country.flag,
    cityIds: CITY_IDS[country.code] ?? [],
  })),
] as const;

export type MarketCode = (typeof MARKETS)[number]["code"] | string;

export function getMarket(code: string) {
  return MARKETS.find((item) => item.code === code) ?? MARKETS[0];
}

export function filterAdsByMarket(
  ads: Ad[],
  marketCode: string,
  cities: FeedCity[] = [],
  force = true,
): Ad[] {
  if (!force || marketCode === GLOBAL_MARKET) return ads;
  return ads.filter((ad) => countryForAd(ad, cities) === marketCode);
}
