export const BIOMES = [
  "ocean",
  "coast",
  "plains",
  "rainforest",
  "temperate_forest",
  "desert",
  "mountains",
  "tundra",
  "wetlands",
  "steppe",
  "volcanic",
  "ice",
] as const;

export type Biome = (typeof BIOMES)[number];

export const CONTRIBUTION_CATEGORIES = [
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

export type ContributionCategory = (typeof CONTRIBUTION_CATEGORIES)[number];

export const WORLD_EVENT_TYPES = [
  "WORLD_CREATED",
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
  "CONTRIBUTION_ADDED",
  "VEGETATION_EXPANDED",
  "POLLUTION_REDUCED",
  "WATER_STRESS_INCREASED",
] as const;

export type WorldEventType = (typeof WORLD_EVENT_TYPES)[number];

export type NumericTraits = {
  size: number;
  growthRate: number;
  waterNeed: number;
  pollutionAbsorption: number;
  nightLuminosity: number;
  coldResistance: number;
  heatResistance: number;
  adaptability: number;
  reproductionRate: number;
  aggression: number;
};

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PlanetRegion extends GeoPoint {
  id: string;
  nameAr: string;
  nameEn: string;
  elevation: number;
  temperature: number;
  moisture: number;
  precipitation: number;
  fertility: number;
  water: number;
  vegetation: number;
  pollution: number;
  population: number;
  carryingCapacity: number;
  biome: Biome;
  resourceRichness: number;
  civilizationId?: string;
}

export interface Civilization {
  id: string;
  nameAr: string;
  nameEn: string;
  regionId: string;
  population: number;
  technology: number;
  economy: number;
  military: number;
  stability: number;
  innovation: number;
  pollution: number;
  relations: Record<string, number>;
  memory: string[];
}

export interface UserContribution {
  id: string;
  ownerId: string;
  category: ContributionCategory;
  name: string;
  description: string;
  traits: NumericTraits;
  possibleBiomes: Biome[];
  risks: string[];
  regionId: string;
  createdAtTick: number;
  status: "analyzed" | "simulated" | "active" | "rejected";
}

export interface CausalLink {
  id: string;
  eventId: string;
  causeEventId?: string;
  contributionId?: string;
  relation: string;
  strength: number;
  explanationAr: string;
  explanationEn: string;
}

export interface WorldEvent<T = Record<string, unknown>> {
  id: string;
  sequence: number;
  planetId: string;
  tick: number;
  year: number;
  type: WorldEventType;
  cause: string;
  regionId?: string;
  contributionId?: string;
  actorIds: string[];
  confidence: number;
  directImpact: Record<string, number>;
  payload: T;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  createdAt: string;
}

export interface PlanetSummary {
  id: string;
  seed: string;
  nameAr: string;
  nameEn: string;
  tick: number;
  year: number;
  status: "running" | "paused";
  regionCount: number;
  civilizationCount: number;
  contributionCount: number;
  eventCount: number;
  globalTemperature: number;
  globalPollution: number;
  biodiversity: number;
  population: number;
}

export interface WorldState {
  planet: PlanetSummary;
  regions: PlanetRegion[];
  civilizations: Civilization[];
  contributions: UserContribution[];
  latestEvents: WorldEvent[];
  checksum: string;
}

export interface ContributionIdea {
  category: ContributionCategory;
  text: string;
  locale: "ar" | "en";
}

export interface ContributionAnalysis {
  category: ContributionCategory;
  name: string;
  description: string;
  traits: NumericTraits;
  possibleBiomes: Biome[];
  risks: string[];
  moderation: {
    accepted: boolean;
    flags: string[];
    reason?: string;
  };
  balance: {
    score: number;
    adjustments: string[];
  };
  provider: string;
  sandbox: boolean;
}

export interface ScenarioOutcome {
  horizonYears: 1 | 10 | 100 | 1000;
  successProbability: number;
  environmentalImpact: number;
  economicImpact: number;
  waterImpact: number;
  populationImpact: number;
  uncertainty: number;
  factors: string[];
}

export interface ContributionPreview {
  analysis: ContributionAnalysis;
  regionId: string;
  habitatSuitability: number;
  scenarios: ScenarioOutcome[];
  bestScenario: ScenarioOutcome;
  likelyScenario: ScenarioOutcome;
  worstScenario: ScenarioOutcome;
  simulationRuns: number;
}

export interface DeltaUpdate {
  sequence: number;
  tick: number;
  changedRegions: Array<Pick<PlanetRegion, "id"> & Partial<PlanetRegion>>;
  events: WorldEvent[];
}
