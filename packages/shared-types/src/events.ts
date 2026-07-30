import { z } from "zod";

import {
  IdentifierSchema,
  LocalizedTextSchema,
  UnitIntervalSchema,
} from "./common.js";
import {
  BiomeIdSchema,
  CivilizationEntitySchema,
  ClimateStateSchema,
  PlantEntitySchema,
  ResourceEntitySchema,
  ResourcePotentialSchema,
  SpeciesEntitySchema,
  TechnologyEntitySchema,
  WorldStateSchema,
} from "./world.js";

export const SIMULATION_EVENT_TYPES = [
  "WORLD_INITIALIZED",
  "SPECIES_CREATED",
  "PLANT_CREATED",
  "RESOURCE_DISCOVERED",
  "CIVILIZATION_FOUNDED",
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
] as const;

export const SimulationEventTypeSchema = z.enum(SIMULATION_EVENT_TYPES);

export const EventCauseSchema = z
  .object({
    kind: z.enum(["SEED", "TICK", "CONTRIBUTION", "EVENT", "SYSTEM"]),
    referenceId: IdentifierSchema,
    explanation: LocalizedTextSchema,
  })
  .strict();

export const RegionChangeSchema = z
  .object({
    regionId: IdentifierSchema,
    population: z.number().finite().nonnegative().optional(),
    carryingCapacity: z.number().finite().nonnegative().optional(),
    pollution: UnitIntervalSchema.optional(),
    temperatureC: z.number().finite().min(-100).max(100).optional(),
    moisture: UnitIntervalSchema.optional(),
    elevation: z.number().finite().min(-1).max(1).optional(),
    biome: BiomeIdSchema.optional(),
    resourcePotential: ResourcePotentialSchema.optional(),
  })
  .strict();

export const ResourceChangeSchema = z
  .object({
    resourceId: IdentifierSchema,
    abundance: UnitIntervalSchema.optional(),
    depleted: z.boolean().optional(),
  })
  .strict();

export const CivilizationChangeSchema = z
  .object({
    civilizationId: IdentifierSchema,
    population: z.number().finite().nonnegative().optional(),
    technologyLevel: UnitIntervalSchema.optional(),
    stability: UnitIntervalSchema.optional(),
    technologyIds: z.array(IdentifierSchema).optional(),
    alliedCivilizationIds: z.array(IdentifierSchema).optional(),
    atWarWithCivilizationIds: z.array(IdentifierSchema).optional(),
  })
  .strict();

export const EventEffectsSchema = z
  .object({
    replaceState: WorldStateSchema.optional(),
    regionChanges: z.array(RegionChangeSchema).optional(),
    climate: ClimateStateSchema.optional(),
    addSpecies: z.array(SpeciesEntitySchema).optional(),
    addPlants: z.array(PlantEntitySchema).optional(),
    addResources: z.array(ResourceEntitySchema).optional(),
    addCivilizations: z.array(CivilizationEntitySchema).optional(),
    addTechnologies: z.array(TechnologyEntitySchema).optional(),
    resourceChanges: z.array(ResourceChangeSchema).optional(),
    civilizationChanges: z.array(CivilizationChangeSchema).optional(),
  })
  .strict();

export const SimulationEventSchema = z
  .object({
    id: IdentifierSchema,
    tick: z.number().int().nonnegative(),
    sequence: z.number().int().nonnegative(),
    type: SimulationEventTypeSchema,
    regionId: IdentifierSchema.optional(),
    title: LocalizedTextSchema,
    description: LocalizedTextSchema,
    causes: z.array(EventCauseSchema).min(1),
    data: z.record(z.string(), z.unknown()),
    effects: EventEffectsSchema,
  })
  .strict();

export const CausalLinkSchema = z
  .object({
    id: IdentifierSchema,
    sourceKind: z.enum(["SEED", "TICK", "CONTRIBUTION", "EVENT", "SYSTEM"]),
    sourceId: IdentifierSchema,
    targetEventId: IdentifierSchema,
    relationship: z.enum(["DIRECT", "SECONDARY", "BACKGROUND"]),
    strength: UnitIntervalSchema,
    explanation: LocalizedTextSchema,
  })
  .strict();

export type SimulationEventType = z.infer<typeof SimulationEventTypeSchema>;
export type EventCause = z.infer<typeof EventCauseSchema>;
export type RegionChange = z.infer<typeof RegionChangeSchema>;
export type ResourceChange = z.infer<typeof ResourceChangeSchema>;
export type CivilizationChange = z.infer<typeof CivilizationChangeSchema>;
export type EventEffects = z.infer<typeof EventEffectsSchema>;
export type SimulationEvent = z.infer<typeof SimulationEventSchema>;
export type CausalLink = z.infer<typeof CausalLinkSchema>;
