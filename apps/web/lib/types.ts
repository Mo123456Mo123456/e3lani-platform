export type Language = "ar" | "en";
export type Quality = "high" | "medium" | "eco";
export type EventKind = "climate" | "energy" | "water" | "community";
export type ContributionCategory = "climate" | "energy" | "water" | "community";
export type EffectMetric =
  | "stability"
  | "biodiversity"
  | "temperature"
  | "population"
  | "prosperity"
  | "pollution";

export interface Region {
  id: string;
  name: Record<Language, string>;
  latitude: number;
  longitude: number;
  population: number;
  vitality: number;
  stability: number;
  terrainColor: string;
  accentColor: string;
  cityLights: number;
}

export interface WorldEvent {
  id: string;
  kind: EventKind;
  title: Record<Language, string>;
  description: Record<Language, string>;
  regionId: string;
  latitude: number;
  longitude: number;
  impact: number;
  occurredAt: string;
}

export interface TimelinePoint {
  year: number;
  vitality: number;
  temperature: number;
  population: number;
  label?: Record<Language, string>;
}

export interface WorldSnapshot {
  id: string;
  name: string;
  generatedAt: string;
  cycle: number;
  temperature: number;
  population: number;
  vitality: number;
  stability: number;
  biodiversity: number;
  isPaused: boolean;
  regions: Region[];
  timeline: TimelinePoint[];
}

export interface ContributionDraft {
  category: ContributionCategory | null;
  title: string;
  idea: string;
  regionId: string | null;
}

export interface ContributionEffect {
  metric: EffectMetric;
  delta: number;
  regionId: string | null;
  civilizationId: string | null;
  rationale: string;
}

export interface ContributionAnalysis {
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
  effects: ContributionEffect[];
  warnings: string[];
  provider?: string;
}

export interface ContributionRequest {
  planetId: string;
  proposal: string;
  regionId: string | null;
}

export interface ForecastMetric {
  key: EffectMetric;
  low: number;
  median: number;
  high: number;
  unit: string;
}

export interface SimulationForecast {
  confidence: number;
  acceptanceProbability: number;
  riskOfInstability: number;
  samples: number;
  summary: Record<Language, string>;
  metrics: ForecastMetric[];
  risks: string[];
  benefits: string[];
  analysis: ContributionAnalysis;
}

export interface ContributionResult {
  id: string;
  acceptedAt: string;
  affectedRegionId: string;
  message: Record<Language, string>;
}

export interface ApiErrorBody {
  error?: {
    message?: string;
    code?: string;
    requestId?: string;
  };
  message?: string;
  code?: string;
}

export interface AuthUser {
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
  sessionExpiresAt?: string;
}
