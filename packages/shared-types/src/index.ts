import { z } from "zod";

export const biomeIds = [
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

export const BiomeIdSchema = z.enum(biomeIds);
export type BiomeId = z.infer<typeof BiomeIdSchema>;

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

export const ContributionCategorySchema = z.enum(contributionCategories);
export type ContributionCategory = z.infer<
  typeof ContributionCategorySchema
>;

export const worldEventTypes = [
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
  "PLANT_SPREAD",
  "POLLUTION_CHANGED",
  "POPULATION_CHANGED",
] as const;

export const WorldEventTypeSchema = z.enum(worldEventTypes);
export type WorldEventType = z.infer<typeof WorldEventTypeSchema>;

const NormalizedTraitSchema = z.number().min(0).max(1);

export const ContributionTraitsSchema = z
  .object({
    size: NormalizedTraitSchema.default(0.5),
    growthRate: NormalizedTraitSchema.default(0.5),
    waterNeed: NormalizedTraitSchema.default(0.5),
    pollutionAbsorption: NormalizedTraitSchema.default(0),
    nightLuminosity: NormalizedTraitSchema.default(0),
    coldResistance: NormalizedTraitSchema.default(0.5),
    heatResistance: NormalizedTraitSchema.default(0.5),
    aggression: NormalizedTraitSchema.default(0),
    intelligence: NormalizedTraitSchema.default(0),
    adaptability: NormalizedTraitSchema.default(0.5),
    energyYield: NormalizedTraitSchema.default(0),
    contagion: NormalizedTraitSchema.default(0),
  })
  .strict();

export type ContributionTraits = z.infer<typeof ContributionTraitsSchema>;

export const ContributionAnalysisSchema = z
  .object({
    category: ContributionCategorySchema,
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().min(3).max(1_000),
    traits: ContributionTraitsSchema,
    possibleBiomes: z.array(BiomeIdSchema).min(1).max(6),
    risks: z.array(z.string().trim().min(2).max(80)).max(8),
    benefits: z.array(z.string().trim().min(2).max(80)).max(8),
    balanceScore: z.number().min(0).max(1),
    moderation: z.object({
      accepted: z.boolean(),
      reasons: z.array(z.string().max(160)).max(8),
      adjusted: z.boolean(),
    }),
    provider: z.string(),
    sandbox: z.boolean(),
  })
  .strict();

export type ContributionAnalysis = z.infer<
  typeof ContributionAnalysisSchema
>;

export const AnalyzeContributionRequestSchema = z
  .object({
    category: ContributionCategorySchema,
    idea: z.string().trim().min(10).max(2_000),
    locale: z.enum(["ar", "en"]).default("ar"),
  })
  .strict();

export type AnalyzeContributionRequest = z.infer<
  typeof AnalyzeContributionRequestSchema
>;

export const CommitContributionRequestSchema = z
  .object({
    analysis: ContributionAnalysisSchema,
    regionId: z.string().uuid(),
    idempotencyKey: z.string().min(12).max(128),
  })
  .strict();

export type CommitContributionRequest = z.infer<
  typeof CommitContributionRequestSchema
>;

export const PlanetRegionSchema = z.object({
  id: z.string().uuid(),
  index: z.number().int().nonnegative(),
  nameAr: z.string(),
  nameEn: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevation: z.number().min(-1).max(1),
  temperature: z.number(),
  moisture: z.number().min(0).max(1),
  fertility: z.number().min(0).max(1),
  pollution: z.number().min(0).max(1),
  population: z.number().nonnegative(),
  biome: BiomeIdSchema,
  resourceRichness: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export type PlanetRegion = z.infer<typeof PlanetRegionSchema>;

export const WorldEventSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  worldId: z.string().uuid(),
  type: WorldEventTypeSchema,
  tick: z.number().int().nonnegative(),
  year: z.number().int(),
  regionId: z.string().uuid().nullable(),
  cause: z.string().min(1),
  causeEventIds: z.array(z.string().uuid()),
  actorIds: z.array(z.string()),
  contributionId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  directImpact: z.record(z.string(), z.number()),
  createdAt: z.string().datetime(),
});

export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const WorldSummarySchema = z.object({
  id: z.string().uuid(),
  nameAr: z.string(),
  nameEn: z.string(),
  seed: z.string(),
  currentTick: z.number().int().nonnegative(),
  currentYear: z.number().int(),
  stateHash: z.string(),
  running: z.boolean(),
  tickDuration: z.enum(["day", "month", "year", "decade"]),
  counts: z.object({
    regions: z.number().int().nonnegative(),
    civilizations: z.number().int().nonnegative(),
    species: z.number().int().nonnegative(),
    plants: z.number().int().nonnegative(),
    resources: z.number().int().nonnegative(),
    events: z.number().int().nonnegative(),
  }),
});

export type WorldSummary = z.infer<typeof WorldSummarySchema>;

export type RealtimeServerEvent =
  | { kind: "world.event"; data: WorldEvent }
  | {
      kind: "world.tick";
      data: Pick<
        WorldSummary,
        "id" | "currentTick" | "currentYear" | "stateHash"
      >;
    }
  | {
      kind: "contribution.status";
      data: {
        contributionId: string;
        status: "queued" | "simulating" | "committed" | "failed";
      };
    };

export const CausalLinkSchema = z.object({
  sourceEventId: z.string().uuid(),
  targetEventId: z.string().uuid(),
  relation: z.enum(["caused", "amplified", "enabled", "mitigated"]),
  strength: z.number().min(0).max(1),
  explanation: z.string(),
});

export type CausalLink = z.infer<typeof CausalLinkSchema>;
