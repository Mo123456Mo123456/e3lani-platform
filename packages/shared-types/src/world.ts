import { z } from "zod";

import {
  IdentifierSchema,
  LocalizedTextSchema,
  SignedUnitIntervalSchema,
  UnitIntervalSchema,
  type LocalizedText,
} from "./common.js";

export const BIOME_IDS = [
  "OCEAN",
  "COAST",
  "ICE",
  "TUNDRA",
  "TAIGA",
  "GRASSLAND",
  "SAVANNA",
  "DESERT",
  "FOREST",
  "RAINFOREST",
  "WETLAND",
  "MOUNTAIN",
] as const;

export const BiomeIdSchema = z.enum(BIOME_IDS);
export type BiomeId = z.infer<typeof BiomeIdSchema>;

export const BIOME_LABELS: Readonly<Record<BiomeId, LocalizedText>> = {
  OCEAN: { ar: "محيط", en: "Ocean" },
  COAST: { ar: "ساحل", en: "Coast" },
  ICE: { ar: "جليد", en: "Ice" },
  TUNDRA: { ar: "تندرا", en: "Tundra" },
  TAIGA: { ar: "غابة شمالية", en: "Taiga" },
  GRASSLAND: { ar: "مراعي", en: "Grassland" },
  SAVANNA: { ar: "سافانا", en: "Savanna" },
  DESERT: { ar: "صحراء", en: "Desert" },
  FOREST: { ar: "غابة", en: "Forest" },
  RAINFOREST: { ar: "غابة مطيرة", en: "Rainforest" },
  WETLAND: { ar: "أراضٍ رطبة", en: "Wetland" },
  MOUNTAIN: { ar: "جبال", en: "Mountain" },
};

export const BiomeSchema = z
  .object({
    id: BiomeIdSchema,
    label: LocalizedTextSchema,
    habitability: UnitIntervalSchema,
  })
  .strict();

export const ResourcePotentialSchema = z
  .object({
    water: UnitIntervalSchema,
    minerals: UnitIntervalSchema,
    biomass: UnitIntervalSchema,
    fertility: UnitIntervalSchema,
    energy: UnitIntervalSchema,
  })
  .strict();

export const RegionSchema = z
  .object({
    id: IdentifierSchema,
    row: z.number().int().nonnegative(),
    column: z.number().int().nonnegative(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    areaWeight: z.number().finite().positive().max(1),
    neighborIds: z.array(IdentifierSchema).min(2).max(8),
    elevation: SignedUnitIntervalSchema,
    temperatureC: z.number().finite().min(-100).max(100),
    moisture: UnitIntervalSchema,
    biome: BiomeIdSchema,
    resourcePotential: ResourcePotentialSchema,
    carryingCapacity: z.number().finite().nonnegative(),
    population: z.number().finite().nonnegative(),
    pollution: UnitIntervalSchema,
  })
  .strict()
  .refine((region) => region.population <= region.carryingCapacity + 1e-7, {
    message: "Region population cannot exceed carrying capacity",
    path: ["population"],
  });

export const SpeciesEntitySchema = z
  .object({
    id: IdentifierSchema,
    contributionId: IdentifierSchema.optional(),
    name: LocalizedTextSchema,
    homeRegionId: IdentifierSchema,
    trophicLevel: z.enum(["PRODUCER", "HERBIVORE", "OMNIVORE", "PREDATOR"]),
    adaptability: UnitIntervalSchema,
    reproductionRate: UnitIntervalSchema,
    ecologicalImpact: SignedUnitIntervalSchema,
  })
  .strict();

export const PlantEntitySchema = z
  .object({
    id: IdentifierSchema,
    contributionId: IdentifierSchema.optional(),
    name: LocalizedTextSchema,
    homeRegionId: IdentifierSchema,
    resilience: UnitIntervalSchema,
    growthRate: UnitIntervalSchema,
    nutrition: UnitIntervalSchema,
    invasiveness: UnitIntervalSchema,
  })
  .strict();

export const ResourceKindSchema = z.enum([
  "WATER",
  "MINERAL",
  "BIOLOGICAL",
  "ENERGY",
]);

export const ResourceEntitySchema = z
  .object({
    id: IdentifierSchema,
    contributionId: IdentifierSchema.optional(),
    name: LocalizedTextSchema,
    regionId: IdentifierSchema,
    kind: ResourceKindSchema,
    abundance: UnitIntervalSchema,
    renewability: UnitIntervalSchema,
    strategicValue: UnitIntervalSchema,
    pollutionRisk: UnitIntervalSchema,
    depleted: z.boolean(),
  })
  .strict();

export const TechnologyDomainSchema = z.enum([
  "AGRICULTURE",
  "MEDICINE",
  "ENERGY",
  "TRANSPORT",
  "COMMUNICATION",
  "MATERIALS",
]);

export const TechnologyEntitySchema = z
  .object({
    id: IdentifierSchema,
    contributionId: IdentifierSchema.optional(),
    name: LocalizedTextSchema,
    regionId: IdentifierSchema,
    civilizationId: IdentifierSchema.optional(),
    domain: TechnologyDomainSchema,
    effectiveness: UnitIntervalSchema,
    pollutionEffect: SignedUnitIntervalSchema,
    populationEffect: SignedUnitIntervalSchema,
  })
  .strict();

export const CivilizationEntitySchema = z
  .object({
    id: IdentifierSchema,
    contributionId: IdentifierSchema.optional(),
    name: LocalizedTextSchema,
    capitalRegionId: IdentifierSchema,
    population: z.number().finite().nonnegative(),
    technologyLevel: UnitIntervalSchema,
    stability: UnitIntervalSchema,
    technologyIds: z.array(IdentifierSchema),
    alliedCivilizationIds: z.array(IdentifierSchema),
    atWarWithCivilizationIds: z.array(IdentifierSchema),
  })
  .strict();

export const WorldConfigSchema = z
  .object({
    rows: z.number().int().min(2).max(256),
    columns: z.number().int().min(4).max(512),
    ticksPerYear: z.number().int().min(1).max(10_000),
  })
  .strict();

export const ClimateStateSchema = z
  .object({
    globalMeanTemperatureC: z.number().finite().min(-100).max(100),
    globalMeanMoisture: UnitIntervalSchema,
    atmosphericCarbonPpm: z.number().finite().min(0).max(100_000),
    seaLevelMeters: z.number().finite().min(-1_000).max(10_000),
  })
  .strict();

export const WorldStateSchema = z
  .object({
    version: z.literal(1),
    id: IdentifierSchema,
    seed: z.string().min(1).max(256),
    tick: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    config: WorldConfigSchema,
    climate: ClimateStateSchema,
    regions: z.array(RegionSchema).min(8),
    species: z.array(SpeciesEntitySchema),
    plants: z.array(PlantEntitySchema),
    resources: z.array(ResourceEntitySchema),
    civilizations: z.array(CivilizationEntitySchema),
    technologies: z.array(TechnologyEntitySchema),
  })
  .strict()
  .superRefine((world, context) => {
    const regionIds = new Set(world.regions.map((region) => region.id));
    if (regionIds.size !== world.regions.length) {
      context.addIssue({
        code: "custom",
        message: "Region IDs must be unique",
        path: ["regions"],
      });
    }

    const collections = [
      world.species,
      world.plants,
      world.resources,
      world.civilizations,
      world.technologies,
    ] as const;
    for (const collection of collections) {
      if (new Set(collection.map((entity) => entity.id)).size !== collection.length) {
        context.addIssue({
          code: "custom",
          message: "Entity IDs must be unique within each collection",
        });
      }
    }
  });

export type Biome = z.infer<typeof BiomeSchema>;
export type ResourcePotential = z.infer<typeof ResourcePotentialSchema>;
export type Region = z.infer<typeof RegionSchema>;
export type SpeciesEntity = z.infer<typeof SpeciesEntitySchema>;
export type PlantEntity = z.infer<typeof PlantEntitySchema>;
export type ResourceKind = z.infer<typeof ResourceKindSchema>;
export type ResourceEntity = z.infer<typeof ResourceEntitySchema>;
export type TechnologyDomain = z.infer<typeof TechnologyDomainSchema>;
export type TechnologyEntity = z.infer<typeof TechnologyEntitySchema>;
export type CivilizationEntity = z.infer<typeof CivilizationEntitySchema>;
export type WorldConfig = z.infer<typeof WorldConfigSchema>;
export type ClimateState = z.infer<typeof ClimateStateSchema>;
export type WorldState = z.infer<typeof WorldStateSchema>;
