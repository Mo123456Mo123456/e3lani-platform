import type { EffectMetric } from "./types";

export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface ApiPlanetSummary {
  id: string;
  name: string;
  slug: string;
  currentTick: number;
  isPaused: boolean;
  stability: number;
  biodiversity: number;
  averageTemperature: number;
  population: number;
  counts: {
    regions: number;
    civilizations: number;
    cities: number;
    resources: number;
    species: number;
    plants: number;
    technologies: number;
  };
}

export interface ApiWorldRegion {
  id: string;
  planetId: string;
  name: string;
  biome: string;
  latitude: number;
  longitude: number;
  population: number;
  stability: number;
}

export interface ApiWorldEvent {
  id: string;
  planetId: string;
  tick: number;
  title: string;
  summary: string;
  category: string;
  magnitude: number;
  causedByContributionId?: string;
  createdAt: string;
}

export interface ApiTimelineSnapshot {
  id: string;
  planetId: string;
  tick: number;
  reason: string;
  state: Record<string, unknown>;
  createdAt: string;
}

export interface ApiContributionEffect {
  metric: EffectMetric;
  delta: number;
  regionId: string | null;
  civilizationId: string | null;
  rationale: string;
}

export interface ApiContributionAnalysis {
  title: string;
  summary: string;
  category:
    | "ecology"
    | "climate"
    | "society"
    | "technology"
    | "diplomacy"
    | "health"
    | "economy";
  plausibility: number;
  confidence: number;
  effects: ApiContributionEffect[];
  causalEventIds: string[];
  warnings: string[];
}

export interface ApiAnalysisResponse {
  analysis: ApiContributionAnalysis;
  provider: {
    provider?: string;
    model?: string;
    sandbox?: boolean;
  };
}

export interface ApiMonteCarloPreview {
  samples: number;
  acceptanceProbability: number;
  riskOfInstability: number;
  projectedEffects: Array<{
    metric: EffectMetric;
    p10: number;
    median: number;
    p90: number;
  }>;
}

export interface ApiPreviewResponse {
  analysis: ApiContributionAnalysis;
  preview: ApiMonteCarloPreview;
}

export interface ApiCommitResponse {
  analysis: ApiContributionAnalysis;
  result: {
    contributionId: string;
    tick: number;
    events: ApiWorldEvent[];
    snapshotId: string;
    replayed: boolean;
  };
}

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  roles: Array<
    | "guest"
    | "user"
    | "explorer"
    | "life_maker"
    | "civilization_creator"
    | "historian"
    | "moderator"
    | "content_moderator"
    | "simulation_manager"
    | "admin"
    | "system_admin"
    | "super_admin"
  >;
}

export interface ApiAuthResponse {
  user: ApiUser;
  session: {
    expiresAt: string;
  };
}
