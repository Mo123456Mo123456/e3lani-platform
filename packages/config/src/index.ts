export const BRAND = {
  nameAr: "كوكب يولد أمامك",
  nameEn: "A Planet Being Born Before You",
  taglineAr: "عالمك، قرارك، أثر لا ينتهي.",
  taglineEn: "Your world, your choice, an endless impact.",
} as const;

export const COLORS = {
  background: "#050B16",
  backgroundAlt: "#0A1628",
  cyan: "#22D3EE",
  green: "#34D399",
  gold: "#FBBF24",
  purple: "#A78BFA",
  red: "#F87171",
  orange: "#FB923C",
  text: "#F8FAFC",
  muted: "#94A3B8",
} as const;

export const ROLES = [
  "guest",
  "user",
  "explorer",
  "life_maker",
  "civ_founder",
  "historian",
  "content_moderator",
  "simulation_manager",
  "system_admin",
  "super_admin",
] as const;

export type Role = (typeof ROLES)[number];

export const CONTRIBUTION_CATEGORIES = [
  "creature",
  "plant",
  "resource",
  "civilization",
  "city",
  "invention",
  "technology",
  "disease",
  "climate",
  "natural_law",
  "disaster",
  "alliance",
  "culture",
  "language",
  "transport",
  "energy",
  "custom",
] as const;

export type ContributionCategory = (typeof CONTRIBUTION_CATEGORIES)[number];

export const EVENT_TYPES = [
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
  "USER_CONTRIBUTION_APPLIED",
  "POLLUTION_CHANGED",
  "POPULATION_CHANGED",
  "PLANT_SPREAD",
] as const;

export type WorldEventType = (typeof EVENT_TYPES)[number];

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

export type Biome = (typeof BIOMES)[number];

export const DEFAULT_PLANET_SEED = 42424242;
export const GRID_SIZE = 64;
