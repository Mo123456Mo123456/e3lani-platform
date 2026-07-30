import { z } from "zod";

/** Contribution / entity categories a user may add to the world */
export const ContributionCategorySchema = z.enum([
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
export type ContributionCategory = z.infer<typeof ContributionCategorySchema>;

export const BiomeTypeSchema = z.enum([
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
]);
export type BiomeType = z.infer<typeof BiomeTypeSchema>;

export const UserRoleSchema = z.enum([
  "guest",
  "registered",
  "explorer",
  "life_maker",
  "civilization_creator",
  "historian",
  "content_moderator",
  "simulation_manager",
  "system_admin",
  "super_admin",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const WorldEventTypeSchema = z.enum([
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
  "PLANT_SPREAD",
  "POLLUTION_CHANGED",
  "USER_CONTRIBUTION_APPLIED",
  "POPULATION_CHANGED",
  "GOVERNMENT_CHANGED",
  "CULTURE_FORMED",
  "NATURAL_DISASTER",
  "FLOOD",
  "DROUGHT",
  "WILDFIRE",
  "ICE_MELT",
]);
export type WorldEventType = z.infer<typeof WorldEventTypeSchema>;

export const TickUnitSchema = z.enum(["day", "month", "year", "decade"]);
export type TickUnit = z.infer<typeof TickUnitSchema>;

export const GraphicsQualitySchema = z.enum([
  "ultra",
  "high",
  "medium",
  "power_saver",
]);
export type GraphicsQuality = z.infer<typeof GraphicsQualitySchema>;

export const LocaleSchema = z.enum(["ar", "en"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const PlanetLayerSchema = z.enum([
  "surface",
  "biome",
  "weather",
  "civilization",
  "resource",
  "conflict",
  "migration",
  "trade",
  "pollution",
  "temperature",
  "historical",
]);
export type PlanetLayer = z.infer<typeof PlanetLayerSchema>;
