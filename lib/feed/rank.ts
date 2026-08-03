import type { Ad } from "../e3lani-data";
import { FALLBACK_COUNTRIES, GLOBAL_MARKET, MY_COUNTRY_MARKET } from "../countries";

export type FeedMode = "forYou" | "nearby" | "latest";

export type FeedCity = {
  id: string;
  region?: string;
  countryCode?: string;
};

export type RankOptions = {
  mode: FeedMode;
  /** `ALL` = global feed. `MINE` resolves to account country with filter. */
  marketCode: string;
  accountCountry?: string;
  categoryId?: string;
  cities?: FeedCity[];
  metrics?: Record<string, { views?: number; saves?: number; shares?: number }>;
  blockedOwners?: string[];
  allCountriesVisibility?: boolean;
  forceCountryFilter?: boolean;
};

export { GLOBAL_MARKET, MY_COUNTRY_MARKET };

function countryForAd(ad: Ad, cities: FeedCity[] = []): string | undefined {
  if (ad.countryCode) return ad.countryCode;
  const city = cities.find((item) => item.id === ad.cityId);
  return city?.countryCode;
}

export function resolveMarketFilter(
  marketCode: string,
  accountCountry?: string,
): { code: string; force: boolean } {
  if (marketCode === GLOBAL_MARKET || marketCode === "ALL") {
    return { code: GLOBAL_MARKET, force: false };
  }
  if (marketCode === MY_COUNTRY_MARKET) {
    return { code: accountCountry || "SA", force: true };
  }
  // Specific country chip: filtering is applied by the caller via forceCountryFilter.
  return { code: marketCode, force: false };
}

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

export function rankFeedAds(ads: Ad[], options: RankOptions): Ad[] {
  const blocked = new Set(options.blockedOwners ?? []);
  let list = ads.filter((ad) => ad.status === "active" && !blocked.has(ad.ownerId));

  if (options.categoryId) {
    list = list.filter((ad) => ad.categoryId === options.categoryId);
  }

  const resolved = resolveMarketFilter(options.marketCode, options.accountCountry);
  const applyCountryFilter =
    resolved.code !== GLOBAL_MARKET &&
    (options.mode === "nearby" ||
      options.forceCountryFilter === true ||
      resolved.force === true ||
      options.allCountriesVisibility === false);

  if (applyCountryFilter) {
    list = list.filter((ad) => countryForAd(ad, options.cities) === resolved.code);
  }

  if (options.mode === "latest") {
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (options.mode === "nearby") {
    const nearbyMarket =
      options.marketCode === GLOBAL_MARKET
        ? options.accountCountry || "SA"
        : resolved.code;
    return [...list]
      .filter((ad) => countryForAd(ad, options.cities) === nearbyMarket)
      .sort((a, b) => {
        const score =
          forYouScore(b, options.metrics, nearbyMarket) -
          forYouScore(a, options.metrics, nearbyMarket);
        if (score !== 0) return score;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  const preferred = resolved.code === GLOBAL_MARKET ? undefined : resolved.code;
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

export function buildMarkets(countries: { code: string; nameAr: string; nameEn: string; flag: string }[]) {
  const source = countries.length ? countries : FALLBACK_COUNTRIES;
  return [
    {
      code: GLOBAL_MARKET,
      nameAr: "جميع الدول",
      nameEn: "All countries",
      flag: "🌍",
      cityIds: [] as string[],
    },
    {
      code: MY_COUNTRY_MARKET,
      nameAr: "دولتي",
      nameEn: "My country",
      flag: "📍",
      cityIds: [] as string[],
    },
    ...source.map((country) => ({
      code: country.code,
      nameAr: country.nameAr,
      nameEn: country.nameEn,
      flag: country.flag,
      cityIds: CITY_IDS[country.code] ?? [],
    })),
  ];
}

export const MARKETS = buildMarkets(FALLBACK_COUNTRIES);

export type MarketCode = string;

export function getMarket(code: string, markets = MARKETS) {
  return markets.find((item) => item.code === code) ?? markets[0];
}

export function filterAdsByMarket(
  ads: Ad[],
  marketCode: string,
  cities: FeedCity[] = [],
  force = true,
  accountCountry?: string,
): Ad[] {
  const resolved = resolveMarketFilter(marketCode, accountCountry);
  if (!force || resolved.code === GLOBAL_MARKET) return ads;
  return ads.filter((ad) => countryForAd(ad, cities) === resolved.code);
}
