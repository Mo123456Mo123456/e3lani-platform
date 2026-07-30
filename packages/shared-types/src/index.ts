export const contributionCategories = [
  "creature",
  "plant",
  "resource",
  "civilization",
  "invention",
  "natural_phenomenon",
  "disease",
  "culture",
  "world_law",
  "custom",
] as const;

export type ContributionCategory = (typeof contributionCategories)[number];

export const worldEventTypes = [
  "RESOURCE_DISCOVERED",
  "SPECIES_CREATED",
  "SPECIES_MUTATED",
  "SPECIES_EXTINCT",
  "CIVILIZATION_FOUNDED",
  "CITY_CREATED",
  "TECHNOLOGY_DISCOVERED",
  "WAR_STARTED",
  "WAR_ENDED",
  "MIGRATION_STARTED",
  "ALLIANCE_CREATED",
  "DISEASE_OUTBREAK",
  "CLIMATE_CHANGED",
  "VOLCANO_ERUPTED",
  "RESOURCE_DEPLETED",
  "TRADE_ROUTE_CREATED",
  "CONTRIBUTION_INTRODUCED",
] as const;

export type WorldEventType = (typeof worldEventTypes)[number];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RegionSummary extends Coordinates {
  id: string;
  name: string;
  biome: string;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  carryingCapacity: number;
  population: number;
  pollution: number;
  controllingCivilization?: string | null;
}

export interface CausalLink {
  id: string;
  sourceEventId: string;
  targetEventId: string;
  mechanism: string;
  strength: number;
}

export interface WorldEvent {
  id: string;
  planetId: string;
  tick: number;
  year: number;
  type: WorldEventType;
  title: string;
  summary: string;
  regionId: string;
  coordinates: Coordinates;
  importance: number;
  confidence: number;
  cause: string;
  directEffects: Record<string, number>;
  contributionId?: string | null;
  createdAt: string;
}

export interface WorldMetrics {
  population: number;
  biodiversity: number;
  meanTemperature: number;
  pollution: number;
  civilizations: number;
  activeConflicts: number;
}

export interface PlanetBootstrap {
  planet: {
    id: string;
    name: string;
    seed: string;
    currentTick: number;
    currentYear: number;
    tickUnit: "year";
    status: "running" | "paused";
  };
  regions: RegionSummary[];
  events: WorldEvent[];
  metrics: WorldMetrics;
}

export interface AnalyzedContribution {
  category: ContributionCategory;
  name: string;
  description: string;
  traits: Record<string, number>;
  possibleBiomes: string[];
  risks: string[];
  balance: {
    score: number;
    adjusted: boolean;
    adjustments: string[];
  };
  provider: string;
  sandbox: boolean;
}

export interface ScenarioOutcome {
  horizonYears: 1 | 10 | 100 | 1000;
  probability: number;
  confidence: number;
  metrics: {
    populationDelta: number;
    biodiversityDelta: number;
    pollutionDelta: number;
    economicDelta: number;
    waterStressDelta: number;
  };
  events: Array<{
    type: WorldEventType;
    year: number;
    probability: number;
    reason: string;
  }>;
}

export interface ContributionPreview {
  contribution: AnalyzedContribution;
  region: RegionSummary;
  suitability: number;
  successProbability: number;
  uncertainty: number;
  shortTerm: ScenarioOutcome;
  longTerm: ScenarioOutcome;
  bestCase: ScenarioOutcome;
  worstCase: ScenarioOutcome;
  causalFactors: Array<{
    factor: string;
    direction: "positive" | "negative";
    weight: number;
  }>;
}

export interface RealtimeDelta {
  sequence: number;
  planetId: string;
  tick: number;
  kind: "event.created" | "region.updated" | "simulation.status" | "notification.created";
  payload: WorldEvent | Partial<RegionSummary> | Record<string, unknown>;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}
