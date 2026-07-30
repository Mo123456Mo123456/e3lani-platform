export const INTERACTION_TYPES = [
  'IMPRESSION',
  'VIEW',
  'WATCH_DURATION',
  'SAVE',
  'UNSAVE',
  'CLICK_WHATSAPP',
  'CLICK_STORE',
  'CLICK_CALL',
  'CLICK_EXTERNAL',
  'SHARE',
  'SKIP',
  'DISMISS',
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const IMPRESSION_SOURCES = ['ORGANIC', 'PAID', 'SMART_RECOMMENDATION'] as const;

export type ImpressionSource = (typeof IMPRESSION_SOURCES)[number];

/**
 * Admin-tunable weights for the hybrid recommender.
 * Stored in SystemSetting `recommendation_weights`.
 */
export type RecommendationWeights = {
  contentBased: number;
  collaborative: number;
  popularity: number;
  location: number;
  recency: number;
  /** Business boost for featured/sponsored — capped so it cannot dominate. */
  featuredBoost: number;
  sponsoredBoost: number;
  /** Max total business contribution (0–1 of final blend before normalize). */
  maxPaidShare: number;
  /** Half-life in hours for recency exponential decay. */
  recencyHalfLifeHours: number;
  /** Minimum positive interactions before collaborative filtering activates. */
  collaborativeMinInteractions: number;
  /** Candidate pool size pulled from DB before scoring. */
  candidatePoolSize: number;
  /** Redis cache TTL for forYou lists (seconds). */
  cacheTtlSeconds: number;
};

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  contentBased: 0.28,
  collaborative: 0.18,
  popularity: 0.22,
  location: 0.14,
  recency: 0.12,
  featuredBoost: 0.04,
  sponsoredBoost: 0.06,
  maxPaidShare: 0.18,
  recencyHalfLifeHours: 72,
  collaborativeMinInteractions: 8,
  candidatePoolSize: 400,
  cacheTtlSeconds: 90,
};

export type AdCandidate = {
  id: string;
  categoryId: string | null;
  parentCategoryId?: string | null;
  cityId: string | null;
  mediaKind: 'image' | 'video' | 'mixed' | null;
  isFeatured: boolean;
  isSponsored: boolean;
  publishedAt: Date | null;
  ownerId: string;
  stats: {
    impressions: number;
    views: number;
    saves: number;
    whatsappClicks: number;
    storeClicks: number;
    callClicks: number;
    shares: number;
    skips: number;
    videoCompletions: number;
    videoWatchCount: number;
  };
};

export type UserTasteProfile = {
  userId?: string;
  cityId?: string | null;
  preferredCategoryIds: Record<string, number>;
  preferredMediaKinds: Record<string, number>;
  preferredCityIds: Record<string, number>;
  likedAdIds: string[];
  /** co-interaction: adId → score from similar users (precomputed snippet). */
  collaborativeScores: Record<string, number>;
  interactionCount: number;
  isColdStart: boolean;
};

export type ScoreBreakdown = {
  contentBased: number;
  collaborative: number;
  popularity: number;
  location: number;
  recency: number;
  business: number;
  final: number;
  source: ImpressionSource;
};

export type RankedAd = {
  adId: string;
  score: number;
  breakdown: ScoreBreakdown;
  source: ImpressionSource;
};

export type RecommendContext = {
  user: UserTasteProfile;
  candidates: AdCandidate[];
  weights: RecommendationWeights;
  now?: Date;
};
