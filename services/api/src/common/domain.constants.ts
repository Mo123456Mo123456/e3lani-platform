export const USER_ROLES = [
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
] as const;

export const ADMIN_ROLES = ["system_admin", "super_admin"] as const;

export const ELEMENT_CATEGORIES = [
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
  "energy",
  "custom",
] as const;

export const BIOME_TYPES = [
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

export type ApiUserRole = (typeof USER_ROLES)[number];
export type ApiElementCategory = (typeof ELEMENT_CATEGORIES)[number];
export type ApiBiomeType = (typeof BIOME_TYPES)[number];
