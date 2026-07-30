import type { RankedAd, RecommendContext, RecommendationWeights, UserTasteProfile } from './types';
import { DEFAULT_RECOMMENDATION_WEIGHTS } from './types';
import { scoreCandidate } from './scorers';

/**
 * Adapter Pattern — swap HeuristicHybridAdapter for Embeddings/ML later
 * without changing NestJS feed wiring.
 */
export interface RecommendationAdapter {
  readonly name: string;
  rank(context: RecommendContext): Promise<RankedAd[]> | RankedAd[];
}

export function normalizeWeights(
  partial?: Partial<RecommendationWeights> | null,
): RecommendationWeights {
  return { ...DEFAULT_RECOMMENDATION_WEIGHTS, ...(partial ?? {}) };
}

export class HeuristicHybridAdapter implements RecommendationAdapter {
  readonly name = 'heuristic-hybrid-v1';

  rank(context: RecommendContext): RankedAd[] {
    const weights = normalizeWeights(context.weights);
    const now = context.now ?? new Date();
    const seen = new Set<string>();
    const catById = new Map(context.candidates.map((c) => [c.id, c.categoryId]));

    const ranked: RankedAd[] = [];
    for (const ad of context.candidates) {
      if (seen.has(ad.id)) continue;
      seen.add(ad.id);
      const breakdown = scoreCandidate(ad, context.user, weights, now);
      ranked.push({
        adId: ad.id,
        score: breakdown.final,
        breakdown,
        source: breakdown.source,
      });
    }

    if (context.user.isColdStart) {
      const seenCats = new Map<string, number>();
      // Sort by popularity+recency-ish first for diversity pass
      ranked.sort((a, b) => b.score - a.score);
      for (const row of ranked) {
        const key = catById.get(row.adId) ?? '_none';
        const count = seenCats.get(key) ?? 0;
        if (count === 0) row.score = Math.min(1, row.score + 0.08);
        else if (count >= 3) row.score = Math.max(0, row.score - 0.05);
        seenCats.set(key, count + 1);
        row.breakdown.final = row.score;
      }
    }

    ranked.sort((a, b) => b.score - a.score || a.adId.localeCompare(b.adId));
    return ranked;
  }
}

/**
 * Future hook: vector/embeddings provider.
 * Production must inject a real implementation; this stub fails closed.
 */
export class EmbeddingsRecommendationAdapter implements RecommendationAdapter {
  readonly name = 'embeddings-stub';

  rank(_context: RecommendContext): RankedAd[] {
    throw new Error(
      'EMBEDDINGS_ADAPTER_NOT_CONFIGURED: set RECOMMENDATION_ADAPTER=heuristic or provide a real embeddings adapter',
    );
  }
}

export function createRecommendationAdapter(
  mode: string | undefined = process.env.RECOMMENDATION_ADAPTER,
): RecommendationAdapter {
  const normalized = (mode ?? 'heuristic').toLowerCase();
  if (normalized === 'embeddings' || normalized === 'ml') {
    return new EmbeddingsRecommendationAdapter();
  }
  return new HeuristicHybridAdapter();
}

export function buildColdStartProfile(cityId?: string | null): UserTasteProfile {
  return {
    cityId: cityId ?? null,
    preferredCategoryIds: {},
    preferredMediaKinds: {},
    preferredCityIds: cityId ? { [cityId]: 1 } : {},
    likedAdIds: [],
    collaborativeScores: {},
    interactionCount: 0,
    isColdStart: true,
  };
}
