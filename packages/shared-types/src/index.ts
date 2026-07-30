import { z } from "zod";

export const IdSchema = z.string().min(1);
export const IsoDateSchema = z.string().datetime();
export const Vector2Schema = z.object({ x: z.number(), y: z.number() });
export const Vector3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

export const RoleSchema = z.enum(["viewer", "creator", "moderator", "admin", "super_admin"]);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  displayName: z.string().min(1),
  roles: z.array(RoleSchema).default(["viewer"]),
  createdAt: IsoDateSchema,
  contributionScore: z.number().int().nonnegative().default(0)
});
export type User = z.infer<typeof UserSchema>;

export const BiomeSchema = z.enum([
  "deep_ocean",
  "shallow_ocean",
  "beach",
  "tundra",
  "taiga",
  "temperate_forest",
  "rainforest",
  "grassland",
  "savanna",
  "desert",
  "mountain",
  "volcanic",
  "ice_cap",
  "wetland"
]);
export type Biome = z.infer<typeof BiomeSchema>;

export const ResourceSchema = z.object({
  id: IdSchema,
  planetId: IdSchema,
  regionId: IdSchema.optional(),
  name: z.string().min(1),
  category: z.enum(["food", "water", "mineral", "energy", "knowledge", "culture", "medicine"]),
  abundance: z.number().min(0).max(1),
  renewability: z.number().min(0).max(1),
  discoveredAtTick: z.number().int().nonnegative().optional()
});
export type Resource = z.infer<typeof ResourceSchema>;

export const PlanetRegionSchema = z.object({
  id: IdSchema,
  planetId: IdSchema,
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  elevation: z.number().min(0).max(1),
  moisture: z.number().min(0).max(1),
  temperature: z.number().min(0).max(1),
  biome: BiomeSchema,
  resources: z.array(ResourceSchema).default([]),
  riverStrength: z.number().min(0).max(1).default(0),
  populationCapacity: z.number().int().nonnegative().default(0)
});
export type PlanetRegion = z.infer<typeof PlanetRegionSchema>;

export const PlanetSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  seed: z.string().min(1),
  ageYears: z.number().int().nonnegative(),
  radiusKm: z.number().positive(),
  regions: z.array(PlanetRegionSchema),
  createdAt: IsoDateSchema
});
export type Planet = z.infer<typeof PlanetSchema>;

export const TraitSchema = z.object({
  name: z.string().min(1),
  value: z.number().finite(),
  description: z.string().optional()
});
export type Trait = z.infer<typeof TraitSchema>;

export const SpeciesSchema = z.object({
  id: IdSchema,
  planetId: IdSchema,
  regionId: IdSchema,
  name: z.string().min(1),
  population: z.number().int().nonnegative(),
  carryingCapacity: z.number().int().nonnegative(),
  preySpeciesIds: z.array(IdSchema).default([]),
  predatorSpeciesIds: z.array(IdSchema).default([]),
  traits: z.array(TraitSchema).default([]),
  createdByContributionId: IdSchema.optional()
});
export type Species = z.infer<typeof SpeciesSchema>;

export const PlantSchema = z.object({
  id: IdSchema,
  planetId: IdSchema,
  regionId: IdSchema,
  name: z.string().min(1),
  biomass: z.number().nonnegative(),
  spreadRate: z.number().min(0).max(1),
  traits: z.array(TraitSchema).default([]),
  createdByContributionId: IdSchema.optional()
});
export type Plant = z.infer<typeof PlantSchema>;

export const TechnologySchema = z.object({
  id: IdSchema,
  civilizationId: IdSchema,
  name: z.string().min(1),
  level: z.number().int().nonnegative(),
  prerequisites: z.array(IdSchema).default([]),
  discoveredAtTick: z.number().int().nonnegative()
});
export type Technology = z.infer<typeof TechnologySchema>;

export const CitySchema = z.object({
  id: IdSchema,
  civilizationId: IdSchema,
  planetId: IdSchema,
  regionId: IdSchema,
  name: z.string().min(1),
  population: z.number().int().nonnegative(),
  stability: z.number().min(0).max(1),
  resources: z.record(z.string(), z.number().nonnegative()).default({})
});
export type City = z.infer<typeof CitySchema>;

export const CivilizationSchema = z.object({
  id: IdSchema,
  planetId: IdSchema,
  name: z.string().min(1),
  foundingTick: z.number().int().nonnegative(),
  population: z.number().int().nonnegative(),
  regionIds: z.array(IdSchema).default([]),
  cityIds: z.array(IdSchema).default([]),
  technologyIds: z.array(IdSchema).default([]),
  cultureTags: z.array(z.string()).default([]),
  stability: z.number().min(0).max(1),
  createdByContributionId: IdSchema.optional()
});
export type Civilization = z.infer<typeof CivilizationSchema>;

export const WorldEventTypeSchema = z.enum([
  "PLANET_GENERATED",
  "RESOURCE_DISCOVERED",
  "SPECIES_CREATED",
  "SPECIES_DECLINED",
  "PLANT_SPREAD",
  "CIVILIZATION_FOUNDED",
  "CITY_FOUNDED",
  "TECHNOLOGY_DISCOVERED",
  "WAR_STARTED",
  "WAR_ENDED",
  "MIGRATION_STARTED",
  "TRADE_ROUTE_OPENED",
  "CLIMATE_SHIFTED",
  "VOLCANO_ERUPTED",
  "DISEASE_OUTBREAK",
  "CULTURE_EMERGED",
  "WORLD_LAW_CHANGED",
  "CONTRIBUTION_APPLIED",
  "SIMULATION_TICKED"
]);
export type WorldEventType = z.infer<typeof WorldEventTypeSchema>;

export const CausalLinkSchema = z.object({
  id: IdSchema,
  fromEventId: IdSchema,
  toEventId: IdSchema,
  reason: z.string().min(1),
  weight: z.number().min(0).max(1).default(1)
});
export type CausalLink = z.infer<typeof CausalLinkSchema>;

export const WorldEventSchema = z.object({
  id: IdSchema,
  planetId: IdSchema,
  tick: z.number().int().nonnegative(),
  type: WorldEventTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  regionId: IdSchema.optional(),
  actorIds: z.array(IdSchema).default([]),
  causeEventIds: z.array(IdSchema).min(1, "Every event must cite at least one cause"),
  data: z.record(z.string(), z.unknown()).default({}),
  createdAt: IsoDateSchema
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const ContributionCategorySchema = z.enum([
  "creature",
  "plant",
  "resource",
  "civilization",
  "invention",
  "natural_phenomenon",
  "disease",
  "culture",
  "world_law",
  "custom"
]);
export type ContributionCategory = z.infer<typeof ContributionCategorySchema>;

export const ContributionStatusSchema = z.enum(["draft", "previewed", "rejected", "confirmed", "applied"]);
export type ContributionStatus = z.infer<typeof ContributionStatusSchema>;

export const UserContributionSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  planetId: IdSchema,
  category: ContributionCategorySchema,
  prompt: z.string().min(2),
  structuredPayload: z.record(z.string(), z.unknown()).default({}),
  status: ContributionStatusSchema,
  balanceNotes: z.array(z.string()).default([]),
  previewEventIds: z.array(IdSchema).default([]),
  confirmedEventIds: z.array(IdSchema).default([]),
  createdAt: IsoDateSchema
});
export type UserContribution = z.infer<typeof UserContributionSchema>;

export const SimulationTickSchema = z.object({
  planetId: IdSchema,
  tick: z.number().int().nonnegative(),
  year: z.number().int().nonnegative(),
  seed: z.string().min(1),
  eventIds: z.array(IdSchema),
  checksum: z.string().min(1),
  createdAt: IsoDateSchema
});
export type SimulationTick = z.infer<typeof SimulationTickSchema>;

export const TimelineSnapshotSchema = z.object({
  id: IdSchema,
  planetId: IdSchema,
  tick: z.number().int().nonnegative(),
  stateChecksum: z.string().min(1),
  summary: z.string().min(1),
  events: z.array(WorldEventSchema),
  species: z.array(SpeciesSchema).default([]),
  civilizations: z.array(CivilizationSchema).default([]),
  createdAt: IsoDateSchema
});
export type TimelineSnapshot = z.infer<typeof TimelineSnapshotSchema>;

export const AIProviderSchema = z.enum(["openai", "anthropic", "gemini", "mock"]);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AIRequestSchema = z.object({
  id: IdSchema,
  userId: IdSchema.optional(),
  planetId: IdSchema,
  provider: AIProviderSchema.default("mock"),
  prompt: z.string().min(1),
  locale: z.enum(["ar", "en"]).default("ar"),
  contributionCategory: ContributionCategorySchema.optional(),
  createdAt: IsoDateSchema
});
export type AIRequest = z.infer<typeof AIRequestSchema>;

export const NotificationSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  planetId: IdSchema,
  eventId: IdSchema.optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  read: z.boolean().default(false),
  createdAt: IsoDateSchema
});
export type Notification = z.infer<typeof NotificationSchema>;

export const SimulationStateSchema = z.object({
  planet: PlanetSchema,
  tick: z.number().int().nonnegative(),
  species: z.record(IdSchema, SpeciesSchema),
  plants: z.record(IdSchema, PlantSchema),
  resources: z.record(IdSchema, ResourceSchema),
  civilizations: z.record(IdSchema, CivilizationSchema),
  cities: z.record(IdSchema, CitySchema),
  technologies: z.record(IdSchema, TechnologySchema),
  events: z.array(WorldEventSchema),
  causalLinks: z.array(CausalLinkSchema)
});
export type SimulationState = z.infer<typeof SimulationStateSchema>;

export function assertWorldEventHasCause(event: WorldEvent): WorldEvent {
  return WorldEventSchema.parse(event);
}

export const ALL_EVENT_TYPES = WorldEventTypeSchema.options;
export const ALL_CONTRIBUTION_CATEGORIES = ContributionCategorySchema.options;
