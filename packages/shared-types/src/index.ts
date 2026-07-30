import { z } from "zod";

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

export const eventTypes = [
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
  "POPULATION_CHANGED",
  "POLLUTION_CHANGED",
  "SIMULATION_TICK_COMPLETED",
] as const;

export type WorldEventType = (typeof eventTypes)[number];

export const biomeTypes = [
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

export type BiomeType = (typeof biomeTypes)[number];

export const numericTraitSchema = z.number().min(0).max(1);

export const contributionTraitsSchema = z
  .object({
    size: numericTraitSchema.default(0.5),
    growthRate: numericTraitSchema.default(0.4),
    waterNeed: numericTraitSchema.default(0.5),
    pollutionAbsorption: numericTraitSchema.default(0),
    nightLuminosity: numericTraitSchema.default(0),
    coldResistance: numericTraitSchema.default(0.5),
    heatResistance: numericTraitSchema.default(0.5),
    reproductionRate: numericTraitSchema.default(0.35),
    aggression: numericTraitSchema.default(0.2),
    intelligence: numericTraitSchema.default(0.3),
    energyYield: numericTraitSchema.default(0.1),
    diseaseResistance: numericTraitSchema.default(0.5),
  })
  .strict();

export const analyzedContributionSchema = z
  .object({
    category: z.enum(contributionCategories),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().min(8).max(800),
    traits: contributionTraitsSchema,
    possibleBiomes: z.array(z.enum(biomeTypes)).min(1).max(5),
    risks: z.array(z.string().trim().min(2).max(80)).max(8),
    advantages: z.array(z.string().trim().min(2).max(120)).max(8),
    balanceScore: z.number().min(0).max(1),
    wasBalanced: z.boolean(),
    provider: z.enum(["openai", "anthropic", "gemini", "local", "sandbox"]),
  })
  .strict();

export const contributionRequestSchema = z
  .object({
    category: z.enum(contributionCategories),
    idea: z.string().trim().min(10).max(1200),
    locale: z.enum(["ar", "en"]).default("ar"),
  })
  .strict();

export const contributionCommitSchema = z
  .object({
    analysis: analyzedContributionSchema,
    regionId: z.string().uuid(),
    expectedPlanetVersion: z.number().int().nonnegative(),
  })
  .strict();

export type ContributionRequest = z.infer<typeof contributionRequestSchema>;
export type AnalyzedContribution = z.infer<typeof analyzedContributionSchema>;
export type ContributionCommit = z.infer<typeof contributionCommitSchema>;

export interface RegionCell {
  id: string;
  index: number;
  nameAr: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  water: number;
  pollution: number;
  population: number;
  carryingCapacity: number;
  biome: BiomeType;
  resourceRichness: number;
  ownerCivilizationId?: string;
}

export interface CivilizationState {
  id: string;
  nameAr: string;
  nameEn: string;
  regionIds: string[];
  population: number;
  technology: number;
  economy: number;
  military: number;
  stability: number;
  health: number;
  education: number;
  pollution: number;
  aggression: number;
  food: number;
  resources: number;
  allies: string[];
  rivals: string[];
}

export interface SpeciesState {
  id: string;
  nameAr: string;
  nameEn: string;
  kind: "plant" | "creature";
  regionIds: string[];
  population: number;
  carryingCapacity: number;
  traits: z.infer<typeof contributionTraitsSchema>;
  contributionId?: string;
}

export interface CausalLink {
  id: string;
  fromEventId: string;
  toEventId: string;
  relation: string;
  strength: number;
}

export interface WorldEvent {
  id: string;
  sequence: number;
  type: WorldEventType;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  simulationYear: number;
  tick: number;
  regionId?: string;
  causeEventIds: string[];
  entityIds: string[];
  contributionId?: string;
  ownerUserId?: string;
  confidence: number;
  importance: number;
  directImpact: Record<string, number>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorldState {
  planetId: string;
  seed: string;
  version: number;
  tick: number;
  year: number;
  tickYears: number;
  paused: boolean;
  climate: {
    meanTemperature: number;
    seaLevel: number;
    emissions: number;
    vegetation: number;
  };
  regions: RegionCell[];
  civilizations: CivilizationState[];
  species: SpeciesState[];
  lastEventSequence: number;
}

export interface TimelineSnapshot {
  id: string;
  planetId: string;
  tick: number;
  year: number;
  eventSequence: number;
  state: WorldState;
  checksum: string;
  createdAt: string;
}

export interface ScenarioOutcome {
  horizonYears: 1 | 10 | 100 | 1000;
  scenario: "most_likely" | "best" | "worst";
  probability: number;
  uncertainty: number;
  temperatureDelta: number;
  populationDelta: number;
  pollutionDelta: number;
  biodiversityDelta: number;
  drivingFactors: string[];
}

export interface WorldOverview {
  planet: {
    id: string;
    nameAr: string;
    nameEn: string;
    seed: string;
    version: number;
    year: number;
    tick: number;
    tickYears: number;
    paused: boolean;
  };
  climate: WorldState["climate"];
  regions: RegionCell[];
  civilizations: CivilizationState[];
  events: WorldEvent[];
  causalLinks: CausalLink[];
  sandbox: boolean;
}

export const socketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("WORLD_DELTA"),
    planetId: z.string(),
    version: z.number().int(),
    events: z.array(z.custom<WorldEvent>()),
    changedRegionIds: z.array(z.string()),
  }),
  z.object({
    type: z.literal("SIMULATION_STATUS"),
    planetId: z.string(),
    tick: z.number().int(),
    paused: z.boolean(),
  }),
  z.object({
    type: z.literal("CONTRIBUTION_STATUS"),
    contributionId: z.string(),
    status: z.enum(["analyzing", "ready", "committed", "rejected"]),
  }),
]);

export type SocketMessage = z.infer<typeof socketMessageSchema>;
