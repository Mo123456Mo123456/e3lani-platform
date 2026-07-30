import { z } from "zod";

/** Element categories a user may add to the world */
export const ElementCategorySchema = z.enum([
  "creature",
  "plant",
  "resource",
  "civilization",
  "city",
  "invention",
  "technology",
  "disease",
  "climate_phenomenon",
  "natural_law",
  "disaster",
  "alliance",
  "culture",
  "language",
  "transport",
  "energy_source",
  "custom",
]);
export type ElementCategory = z.infer<typeof ElementCategorySchema>;

export const BiomeTypeSchema = z.enum([
  "ocean",
  "coast",
  "plains",
  "rainforest",
  "temperate_forest",
  "desert",
  "mountain",
  "tundra",
  "swamp",
  "steppe",
  "volcanic",
  "ice",
]);
export type BiomeType = z.infer<typeof BiomeTypeSchema>;

export const WorldEventTypeSchema = z.enum([
  "RESOURCE_DISCOVERED",
  "SPECIES_CREATED",
  "SPECIES_MUTATED",
  "SPECIES_EXTINCT",
  "PLANT_CREATED",
  "PLANT_SPREAD",
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
  "USER_CONTRIBUTION",
  "POPULATION_BOOM",
  "POLLUTION_SPIKE",
  "FLOOD",
  "DROUGHT",
  "FIRE",
  "CULTURE_BORN",
  "GOVERNMENT_CHANGED",
]);
export type WorldEventType = z.infer<typeof WorldEventTypeSchema>;

export const RoleSchema = z.enum([
  "guest",
  "user",
  "explorer",
  "life_maker",
  "civilization_creator",
  "historian",
  "content_moderator",
  "simulation_manager",
  "system_admin",
  "super_admin",
]);
export type Role = z.infer<typeof RoleSchema>;

export const TraitMapSchema = z.record(z.string(), z.number().min(0).max(1));
export type TraitMap = z.infer<typeof TraitMapSchema>;

export const StructuredElementSchema = z.object({
  category: ElementCategorySchema,
  name: z.string().min(1).max(120),
  nameAr: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  traits: TraitMapSchema,
  possibleBiomes: z.array(BiomeTypeSchema).min(1),
  risks: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  balanceScore: z.number().min(0).max(1).optional(),
  balanced: z.boolean().default(true),
  balanceNotes: z.array(z.string()).default([]),
});
export type StructuredElement = z.infer<typeof StructuredElementSchema>;

export const CausalLinkSchema = z.object({
  id: z.string(),
  causeEventId: z.string(),
  effectEventId: z.string(),
  relation: z.string(),
  strength: z.number().min(0).max(1),
  delayTicks: z.number().int().nonnegative(),
});
export type CausalLink = z.infer<typeof CausalLinkSchema>;

export const WorldEventPayloadSchema = z.object({
  id: z.string(),
  type: WorldEventTypeSchema,
  tick: z.number().int().nonnegative(),
  year: z.number(),
  regionId: z.string().nullable(),
  title: z.string(),
  titleAr: z.string(),
  description: z.string(),
  descriptionAr: z.string(),
  importance: z.number().min(0).max(1),
  cause: z.string().nullable(),
  relatedEntityIds: z.array(z.string()).default([]),
  contributionId: z.string().nullable().optional(),
  directImpact: z.record(z.string(), z.number()).default({}),
  confidence: z.number().min(0).max(1).default(1),
  metadata: z.record(z.unknown()).default({}),
});
export type WorldEventPayload = z.infer<typeof WorldEventPayloadSchema>;

export const RegionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string(),
  biome: BiomeTypeSchema,
  lat: z.number(),
  lon: z.number(),
  elevation: z.number(),
  temperature: z.number(),
  moisture: z.number(),
  fertility: z.number(),
  population: z.number().optional(),
  civilizationId: z.string().nullable().optional(),
  pollution: z.number().optional(),
  resources: z.array(z.string()).optional(),
});
export type RegionSummary = z.infer<typeof RegionSummarySchema>;

export const GraphicsQualitySchema = z.enum([
  "ultra",
  "high",
  "medium",
  "power_saver",
]);
export type GraphicsQuality = z.infer<typeof GraphicsQualitySchema>;

export const LocaleSchema = z.enum(["ar", "en"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const WsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("world.event"),
    payload: WorldEventPayloadSchema,
  }),
  z.object({
    type: z.literal("simulation.tick"),
    payload: z.object({
      tick: z.number(),
      year: z.number(),
      eventsCount: z.number(),
    }),
  }),
  z.object({
    type: z.literal("contribution.status"),
    payload: z.object({
      contributionId: z.string(),
      status: z.enum([
        "analyzing",
        "balanced",
        "simulating",
        "committed",
        "rejected",
        "failed",
      ]),
      message: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("notification"),
    payload: z.object({
      id: z.string(),
      title: z.string(),
      titleAr: z.string(),
      body: z.string(),
      bodyAr: z.string(),
      kind: z.string(),
    }),
  }),
  z.object({
    type: z.literal("ai.status"),
    payload: z.object({
      requestId: z.string(),
      status: z.enum(["queued", "running", "done", "error", "sandbox"]),
      provider: z.string(),
    }),
  }),
  z.object({
    type: z.literal("delta"),
    payload: z.object({
      entity: z.string(),
      id: z.string(),
      patch: z.record(z.unknown()),
    }),
  }),
]);
export type WsMessage = z.infer<typeof WsMessageSchema>;

export const CATEGORY_COLORS: Record<ElementCategory, string> = {
  creature: "#3B82F6",
  plant: "#22C55E",
  resource: "#94A3B8",
  civilization: "#EAB308",
  city: "#F59E0B",
  invention: "#06B6D4",
  technology: "#0EA5E9",
  disease: "#EF4444",
  climate_phenomenon: "#38BDF8",
  natural_law: "#A78BFA",
  disaster: "#F97316",
  alliance: "#C084FC",
  culture: "#A855F7",
  language: "#D946EF",
  transport: "#64748B",
  energy_source: "#FACC15",
  custom: "#E2E8F0",
};

export const BIOME_COLORS: Record<BiomeType, string> = {
  ocean: "#0B3D91",
  coast: "#1E90AA",
  plains: "#7CB342",
  rainforest: "#1B5E20",
  temperate_forest: "#2E7D32",
  desert: "#C2A14D",
  mountain: "#6B7280",
  tundra: "#94A3B8",
  swamp: "#4A5D23",
  steppe: "#A3B18A",
  volcanic: "#7F1D1D",
  ice: "#E0F2FE",
};
