import { z } from "zod";

export const BIOMES = [
  "ocean",
  "coast",
  "plains",
  "rainforest",
  "temperate_forest",
  "desert",
  "mountain",
  "tundra",
  "wetland",
  "steppe",
  "volcanic",
  "ice",
] as const;

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

export const WORLD_EVENT_TYPES = [
  "WORLD_CREATED",
  "CONTRIBUTION_ADDED",
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
  "VEGETATION_SPREAD",
  "POLLUTION_CHANGED",
  "TICK_COMPLETED",
] as const;

export type Biome = (typeof BIOMES)[number];
export type ContributionCategory = (typeof CONTRIBUTION_CATEGORIES)[number];
export type WorldEventType = (typeof WORLD_EVENT_TYPES)[number];

export const numericTraitSchema = z.number().min(0).max(1);

export const contributionAnalysisSchema = z.object({
  category: z.enum(CONTRIBUTION_CATEGORIES),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(8).max(2_000),
  traits: z
    .record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/), numericTraitSchema)
    .refine(
      (traits) =>
        Object.keys(traits).length >= 2 && Object.keys(traits).length <= 24,
      "Between 2 and 24 numeric traits are required",
    ),
  possibleBiomes: z.array(z.enum(BIOMES)).min(1).max(6),
  risks: z.array(z.string().min(2).max(80)).max(10),
  balancedChanges: z.array(z.string().min(2).max(200)).max(10),
  provider: z.enum([
    "openai",
    "anthropic",
    "gemini",
    "local",
    "sandbox-rule-engine",
  ]),
  model: z.string().min(1),
});

export const contributionRequestSchema = z.object({
  idea: z.string().trim().min(8).max(2_000),
  locale: z.enum(["ar", "en"]).default("ar"),
  preferredCategory: z.enum(CONTRIBUTION_CATEGORIES).optional(),
});

export const contributionCommitSchema = z.object({
  analysis: contributionAnalysisSchema,
  regionId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ContributionAnalysis = z.infer<typeof contributionAnalysisSchema>;
export type ContributionRequest = z.infer<typeof contributionRequestSchema>;

export interface PlanetRegion {
  id: string;
  index: number;
  latitude: number;
  longitude: number;
  elevation: number;
  temperature: number;
  moisture: number;
  rainfall: number;
  fertility: number;
  surfaceWater: number;
  vegetation: number;
  pollution: number;
  population: number;
  biome: Biome;
  resources: Record<string, number>;
}

export interface CivilizationState {
  id: string;
  name: string;
  regionId: string;
  population: number;
  food: number;
  economy: number;
  technology: number;
  military: number;
  stability: number;
  pollution: number;
  aggression: number;
  innovation: number;
  memory: Array<{ eventId: string; valence: number; year: number }>;
}

export interface SpeciesState {
  id: string;
  name: string;
  regionId: string;
  population: number;
  carryingCapacity: number;
  reproductionRate: number;
  adaptability: number;
  heatResistance: number;
  coldResistance: number;
  waterNeed: number;
  trophicLevel: number;
}

export interface WorldState {
  planetId: string;
  seed: string;
  version: number;
  tick: number;
  year: number;
  tickYears: number;
  regions: PlanetRegion[];
  civilizations: CivilizationState[];
  species: SpeciesState[];
}

export interface CausalLink {
  id: string;
  fromEventId: string;
  toEventId: string;
  relation: "causes" | "contributes_to" | "prevents" | "amplifies";
  strength: number;
  explanation: string;
}

export interface WorldEvent {
  id: string;
  planetId: string;
  type: WorldEventType;
  tick: number;
  year: number;
  regionId: string | null;
  cause: string;
  actorIds: string[];
  payload: Record<string, unknown>;
  confidence: number;
  directImpact: Record<string, number>;
  rootContributionId: string | null;
  causedByEventIds: string[];
  createdAt: string;
}

export interface WorldDelta {
  planetId: string;
  fromVersion: number;
  toVersion: number;
  tick: number;
  year: number;
  changedRegions: Array<Pick<PlanetRegion, "id"> & Partial<PlanetRegion>>;
  changedCivilizations: Array<
    Pick<CivilizationState, "id"> & Partial<CivilizationState>
  >;
  events: WorldEvent[];
}

export interface WorldOverview {
  state: WorldState;
  recentEvents: WorldEvent[];
  contributionCount: number;
  simulationStatus: "running" | "paused";
  dataSource: "postgresql";
}

export interface FutureScenario {
  horizonYears: 1 | 10 | 100 | 1000;
  likely: Record<string, number>;
  best: Record<string, number>;
  worst: Record<string, number>;
  uncertainty: number;
  influentialFactors: string[];
}
