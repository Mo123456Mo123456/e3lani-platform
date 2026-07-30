import { describe, expect, it } from 'vitest';
import { HeuristicHybridAdapter, buildColdStartProfile, normalizeWeights } from './adapter';
import {
  scoreBusiness,
  scoreContentBased,
  scoreLocation,
  scorePopularity,
  scoreRecency,
} from './scorers';
import type { AdCandidate, UserTasteProfile } from './types';

function candidate(partial: Partial<AdCandidate> & { id: string }): AdCandidate {
  return {
    categoryId: 'cat-cars',
    cityId: 'city-riyadh',
    mediaKind: 'video',
    isFeatured: false,
    isSponsored: false,
    publishedAt: new Date(),
    ownerId: 'owner-1',
    stats: {
      impressions: 100,
      views: 80,
      saves: 10,
      whatsappClicks: 8,
      storeClicks: 2,
      callClicks: 1,
      shares: 3,
      skips: 5,
      videoCompletions: 20,
      videoWatchCount: 40,
    },
    ...partial,
  };
}

describe('recommendation scorers', () => {
  it('prefers matching category and city in content-based score', () => {
    const user: UserTasteProfile = {
      cityId: 'city-riyadh',
      preferredCategoryIds: { 'cat-cars': 5, 'cat-jobs': 1 },
      preferredMediaKinds: { video: 3 },
      preferredCityIds: { 'city-riyadh': 4 },
      likedAdIds: [],
      collaborativeScores: {},
      interactionCount: 12,
      isColdStart: false,
    };
    const match = scoreContentBased(candidate({ id: 'a1' }), user);
    const miss = scoreContentBased(
      candidate({ id: 'a2', categoryId: 'cat-jobs', cityId: 'city-jeddah', mediaKind: 'image' }),
      user,
    );
    expect(match).toBeGreaterThan(miss);
  });

  it('caps business boost so paid cannot dominate', () => {
    const weights = normalizeWeights({
      featuredBoost: 0.5,
      sponsoredBoost: 0.5,
      maxPaidShare: 0.18,
    });
    const score = scoreBusiness(
      candidate({ id: 'paid', isFeatured: true, isSponsored: true }),
      weights,
    );
    expect(score).toBeLessThanOrEqual(0.18);
  });

  it('decays recency with age', () => {
    const weights = normalizeWeights({ recencyHalfLifeHours: 24 });
    const now = new Date('2026-07-30T12:00:00Z');
    const fresh = scoreRecency(
      candidate({ id: 'f', publishedAt: new Date('2026-07-30T10:00:00Z') }),
      weights,
      now,
    );
    const old = scoreRecency(
      candidate({ id: 'o', publishedAt: new Date('2026-07-20T10:00:00Z') }),
      weights,
      now,
    );
    expect(fresh).toBeGreaterThan(old);
  });

  it('boosts same-city location score', () => {
    const user = buildColdStartProfile('city-riyadh');
    expect(scoreLocation(candidate({ id: '1', cityId: 'city-riyadh' }), user)).toBe(1);
    expect(scoreLocation(candidate({ id: '2', cityId: 'city-jeddah' }), user)).toBeLessThan(0.2);
  });

  it('ranks hybrid list with cold-start diversity', () => {
    const adapter = new HeuristicHybridAdapter();
    const candidates = [
      candidate({ id: 'a', categoryId: 'c1', isSponsored: true, stats: { ...candidate({ id: 'x' }).stats, impressions: 1000, saves: 50 } }),
      candidate({ id: 'b', categoryId: 'c1', publishedAt: new Date(Date.now() - 86400000) }),
      candidate({ id: 'c', categoryId: 'c2', cityId: 'city-riyadh' }),
      candidate({ id: 'd', categoryId: 'c3', mediaKind: 'image' }),
    ];
    const ranked = adapter.rank({
      user: buildColdStartProfile('city-riyadh'),
      candidates,
      weights: normalizeWeights(),
    });
    expect(ranked).toHaveLength(4);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[1]!.score);
    expect(ranked.every((r) => r.source)).toBe(true);
  });

  it('computes popularity from engagement rates', () => {
    const hot = scorePopularity(
      candidate({
        id: 'hot',
        stats: {
          impressions: 200,
          views: 180,
          saves: 40,
          whatsappClicks: 30,
          storeClicks: 10,
          callClicks: 5,
          shares: 8,
          skips: 2,
          videoCompletions: 60,
          videoWatchCount: 100,
        },
      }),
    );
    const cold = scorePopularity(
      candidate({
        id: 'cold',
        stats: {
          impressions: 200,
          views: 10,
          saves: 0,
          whatsappClicks: 0,
          storeClicks: 0,
          callClicks: 0,
          shares: 0,
          skips: 80,
          videoCompletions: 0,
          videoWatchCount: 10,
        },
      }),
    );
    expect(hot).toBeGreaterThan(cold);
  });
});
