import type {
  AdCandidate,
  RecommendationWeights,
  ScoreBreakdown,
  UserTasteProfile,
} from './types';

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function sumValues(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

/** Content-based: category, subcategory, city, media kind affinity from user taste. */
export function scoreContentBased(ad: AdCandidate, user: UserTasteProfile): number {
  const catTotal = sumValues(user.preferredCategoryIds) || 1;
  const cityTotal = sumValues(user.preferredCityIds) || 1;
  const mediaTotal = sumValues(user.preferredMediaKinds) || 1;

  let score = 0;
  if (ad.categoryId) {
    score += 0.45 * ((user.preferredCategoryIds[ad.categoryId] ?? 0) / catTotal);
  }
  if (ad.parentCategoryId) {
    score += 0.15 * ((user.preferredCategoryIds[ad.parentCategoryId] ?? 0) / catTotal);
  }
  if (ad.cityId) {
    score += 0.25 * ((user.preferredCityIds[ad.cityId] ?? 0) / cityTotal);
  }
  if (ad.mediaKind) {
    score += 0.15 * ((user.preferredMediaKinds[ad.mediaKind] ?? 0) / mediaTotal);
  }
  return clamp01(score);
}

/** Collaborative: uses precomputed neighbor affinity per ad. */
export function scoreCollaborative(
  ad: AdCandidate,
  user: UserTasteProfile,
  weights: RecommendationWeights,
): number {
  if (user.interactionCount < weights.collaborativeMinInteractions) return 0;
  const raw = user.collaborativeScores[ad.id] ?? 0;
  return clamp01(raw);
}

/**
 * Popularity & trending from engagement rates + absolute volume (log-scaled).
 */
export function scorePopularity(ad: AdCandidate): number {
  const s = ad.stats;
  const impressions = Math.max(s.impressions, 1);
  const saveRate = s.saves / impressions;
  const clickRate =
    (s.whatsappClicks + s.storeClicks + s.callClicks + s.shares) / impressions;
  const completionRate =
    s.videoWatchCount > 0 ? s.videoCompletions / s.videoWatchCount : 0;
  const skipPenalty = Math.min(0.35, s.skips / impressions);

  const volume = Math.log10(1 + s.views + s.impressions * 0.25) / 5;
  const quality = saveRate * 0.35 + clickRate * 0.4 + completionRate * 0.25;

  return clamp01(quality * 0.7 + volume * 0.3 - skipPenalty);
}

/** Location: same city strong, else mild if user has no city. */
export function scoreLocation(ad: AdCandidate, user: UserTasteProfile): number {
  if (!user.cityId) {
    // Mild boost for ads in cities the user already engaged with.
    if (ad.cityId && (user.preferredCityIds[ad.cityId] ?? 0) > 0) return 0.55;
    return 0.35;
  }
  if (ad.cityId === user.cityId) return 1;
  if (ad.cityId && (user.preferredCityIds[ad.cityId] ?? 0) > 0) return 0.55;
  return 0.12;
}

/** Recency exponential decay with configurable half-life. */
export function scoreRecency(
  ad: AdCandidate,
  weights: RecommendationWeights,
  now: Date,
): number {
  if (!ad.publishedAt) return 0.1;
  const ageMs = Math.max(0, now.getTime() - ad.publishedAt.getTime());
  const halfLifeMs = Math.max(1, weights.recencyHalfLifeHours) * 3600_000;
  const decay = Math.pow(0.5, ageMs / halfLifeMs);
  return clamp01(decay);
}

/**
 * Business rules: featured/sponsored boosts with hard cap so paid never dominates.
 */
export function scoreBusiness(ad: AdCandidate, weights: RecommendationWeights): number {
  let boost = 0;
  if (ad.isFeatured) boost += weights.featuredBoost;
  if (ad.isSponsored) boost += weights.sponsoredBoost;
  return clamp01(Math.min(boost, weights.maxPaidShare));
}

export function blendScores(
  parts: Omit<ScoreBreakdown, 'final' | 'source'>,
  weights: RecommendationWeights,
  ad: AdCandidate,
): ScoreBreakdown {
  const organic =
    parts.contentBased * weights.contentBased +
    parts.collaborative * weights.collaborative +
    parts.popularity * weights.popularity +
    parts.location * weights.location +
    parts.recency * weights.recency;

  const business = Math.min(parts.business, weights.maxPaidShare);
  const final = clamp01(organic + business);

  let source: ScoreBreakdown['source'] = 'SMART_RECOMMENDATION';
  if (ad.isSponsored && business >= organic * 0.5) {
    source = 'PAID';
  } else if (
    parts.contentBased < 0.05 &&
    parts.collaborative < 0.05 &&
    parts.popularity >= 0.4
  ) {
    source = 'ORGANIC';
  }

  return { ...parts, business, final, source };
}

export function scoreCandidate(
  ad: AdCandidate,
  user: UserTasteProfile,
  weights: RecommendationWeights,
  now: Date,
): ScoreBreakdown {
  const parts = {
    contentBased: scoreContentBased(ad, user),
    collaborative: scoreCollaborative(ad, user, weights),
    popularity: scorePopularity(ad),
    location: scoreLocation(ad, user),
    recency: scoreRecency(ad, weights, now),
    business: scoreBusiness(ad, weights),
  };
  return blendScores(parts, weights, ad);
}

/**
 * Cold-start mix: popularity + location + recency + light category diversity.
 * Mutates scores with a diversity bonus for underrepresented categories in top-N.
 */
export function applyColdStartMix(
  ranked: Array<{ adId: string; score: number; categoryId: string | null }>,
): void {
  const seenCats = new Map<string, number>();
  for (const row of ranked) {
    const key = row.categoryId ?? '_none';
    const count = seenCats.get(key) ?? 0;
    if (count === 0) row.score += 0.08;
    else if (count >= 3) row.score -= 0.05;
    seenCats.set(key, count + 1);
    row.score = clamp01(row.score);
  }
}
