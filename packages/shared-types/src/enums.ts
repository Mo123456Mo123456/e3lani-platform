/**
 * Canonical enums shared by the simulation engine, API, web and admin apps.
 * Keep this file dependency-free: every workspace package may import it.
 */

export const BIOME_TYPES = [
  "ocean",
  "coast",
  "plains",
  "rainforest",
  "temperate_forest",
  "desert",
  "mountains",
  "tundra",
  "swamp",
  "steppe",
  "volcanic",
  "ice",
] as const;
export type BiomeType = (typeof BIOME_TYPES)[number];

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
  // genesis
  "PLANET_FORMED",
  "OCEANS_FORMED",
  "LIFE_EMERGED",
  "PLANTS_SPREAD",
  // user-driven
  "ELEMENT_ADDED",
  "ELEMENT_REJECTED",
  // ecology
  "SPECIES_CREATED",
  "SPECIES_MUTATED",
  "SPECIES_EXTINCT",
  "SPECIES_MIGRATED",
  "POPULATION_BOOM",
  // civilization
  "CIVILIZATION_FOUNDED",
  "CIVILIZATION_COLLAPSED",
  "CITY_CREATED",
  "CITY_DESTROYED",
  "TECHNOLOGY_DISCOVERED",
  "CULTURE_EMERGED",
  "LANGUAGE_EMERGED",
  // economy
  "RESOURCE_DISCOVERED",
  "RESOURCE_DEPLETED",
  "TRADE_ROUTE_CREATED",
  "TRADE_ROUTE_BROKEN",
  "ECONOMIC_CRISIS",
  // politics
  "WAR_STARTED",
  "WAR_ENDED",
  "ALLIANCE_CREATED",
  "ALLIANCE_BROKEN",
  "TREATY_SIGNED",
  "GOVERNMENT_CHANGED",
  // movement / health
  "MIGRATION_STARTED",
  "MIGRATION_COMPLETED",
  "DISEASE_OUTBREAK",
  "DISEASE_CONTAINED",
  // climate & geology
  "CLIMATE_CHANGED",
  "STORM_FORMED",
  "DROUGHT_STARTED",
  "DROUGHT_ENDED",
  "WILDFIRE_STARTED",
  "FLOOD_OCCURRED",
  "VOLCANO_ERUPTED",
  "SEA_LEVEL_CHANGED",
  "POLLUTION_SPIKE",
] as const;
export type WorldEventType = (typeof WORLD_EVENT_TYPES)[number];

export const TICK_DURATIONS = ["day", "month", "year", "decade"] as const;
export type TickDuration = (typeof TICK_DURATIONS)[number];

export const LAYER_IDS = [
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
  "history",
] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export const USER_ROLES = [
  "USER",
  "EXPLORER",
  "LIFE_MAKER",
  "CIV_BUILDER",
  "HISTORIAN",
  "MODERATOR",
  "SIM_ADMIN",
  "SYS_ADMIN",
  "SUPER_ADMIN",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles allowed into the admin app, ordered from least to most privileged. */
export const ADMIN_ROLES: readonly UserRole[] = ["MODERATOR", "SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN"];

export const GOVERNMENT_TYPES = [
  "tribe",
  "chiefdom",
  "monarchy",
  "republic",
  "theocracy",
  "empire",
  "federation",
] as const;
export type GovernmentType = (typeof GOVERNMENT_TYPES)[number];

export const TECH_ERAS = [
  "stone",
  "bronze",
  "iron",
  "classical",
  "medieval",
  "industrial",
  "atomic",
  "information",
  "fusion",
] as const;
export type TechEra = (typeof TECH_ERAS)[number];

export const WAR_STATUSES = ["active", "ceasefire", "resolved"] as const;
export type WarStatus = (typeof WAR_STATUSES)[number];

export const ALLIANCE_STATUSES = ["active", "broken"] as const;
export type AllianceStatus = (typeof ALLIANCE_STATUSES)[number];

export const CONTRIBUTION_STATUSES = [
  "draft",
  "analyzing",
  "preview",
  "confirmed",
  "active",
  "rejected",
] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export const MODERATION_STATUSES = ["pending", "approved", "rejected", "flagged"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const RESOURCE_KINDS = [
  "grain",
  "fish",
  "timber",
  "stone",
  "copper",
  "iron",
  "gold",
  "coal",
  "oil",
  "uranium",
  "crystal",
  "spice",
  "fresh_water",
  "solar",
  "wind",
  "geothermal",
] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const QUALITY_PRESETS = ["ultra", "high", "medium", "power_saver"] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
