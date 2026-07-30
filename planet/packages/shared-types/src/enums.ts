/** Biome classifications produced by the planet generator. */
export enum BiomeType {
  Ocean = "ocean",
  Coast = "coast",
  Plains = "plains",
  Rainforest = "rainforest",
  TemperateForest = "temperate_forest",
  Desert = "desert",
  Mountains = "mountains",
  Tundra = "tundra",
  Swamp = "swamp",
  Steppe = "steppe",
  Volcanic = "volcanic",
  Ice = "ice",
}

/** Categories of elements a user may add to the world. */
export enum ContributionCategory {
  Creature = "creature",
  Plant = "plant",
  Resource = "resource",
  Civilization = "civilization",
  Invention = "invention",
  NaturalPhenomenon = "natural_phenomenon",
  Disease = "disease",
  Culture = "culture",
  WorldLaw = "world_law",
  Custom = "custom",
}

/** Canonical world event types emitted by the simulation engine. */
export enum WorldEventType {
  ResourceDiscovered = "RESOURCE_DISCOVERED",
  ResourceDepleted = "RESOURCE_DEPLETED",
  SpeciesCreated = "SPECIES_CREATED",
  SpeciesMutated = "SPECIES_MUTATED",
  SpeciesExtinct = "SPECIES_EXTINCT",
  PlantSpread = "PLANT_SPREAD",
  CivilizationFounded = "CIVILIZATION_FOUNDED",
  CityCreated = "CITY_CREATED",
  CityFallen = "CITY_FALLEN",
  TechnologyDiscovered = "TECHNOLOGY_DISCOVERED",
  WarStarted = "WAR_STARTED",
  WarEnded = "WAR_ENDED",
  MigrationStarted = "MIGRATION_STARTED",
  AllianceCreated = "ALLIANCE_CREATED",
  AllianceBroken = "ALLIANCE_BROKEN",
  DiseaseOutbreak = "DISEASE_OUTBREAK",
  ClimateChanged = "CLIMATE_CHANGED",
  VolcanoErupted = "VOLCANO_ERUPTED",
  WildfireStarted = "WILDFIRE_STARTED",
  FloodOccurred = "FLOOD_OCCURRED",
  TradeRouteCreated = "TRADE_ROUTE_CREATED",
  ContributionApplied = "CONTRIBUTION_APPLIED",
  EraStarted = "ERA_STARTED",
}

export enum ResourceKind {
  Water = "water",
  Food = "food",
  Timber = "timber",
  Stone = "stone",
  MetalOre = "metal_ore",
  RareEarth = "rare_earth",
  EnergySource = "energy_source",
  FertileLand = "fertile_land",
  Medicine = "medicine",
  Gem = "gem",
}

export enum CivRelation {
  War = "war",
  Hostile = "hostile",
  Neutral = "neutral",
  Trade = "trade",
  Alliance = "alliance",
}

export enum GovernmentType {
  Tribe = "tribe",
  Monarchy = "monarchy",
  Republic = "republic",
  Theocracy = "theocracy",
  Technocracy = "technocracy",
}

export enum UserRole {
  Visitor = "visitor",
  Registered = "registered",
  Explorer = "explorer",
  LifeMaker = "life_maker",
  CivBuilder = "civ_builder",
  Historian = "historian",
  ContentModerator = "content_moderator",
  SimulationManager = "simulation_manager",
  SystemAdmin = "system_admin",
  SuperAdmin = "super_admin",
}

export enum ContributionStatus {
  Draft = "draft",
  Analyzing = "analyzing",
  Previewed = "previewed",
  Applied = "applied",
  Rejected = "rejected",
}

export enum AiProviderName {
  Mock = "mock",
  OpenAI = "openai",
  Anthropic = "anthropic",
  Gemini = "gemini",
}

/** Render layers toggleable on the 3D planet. */
export enum RenderLayer {
  Surface = "surface",
  Biome = "biome",
  Weather = "weather",
  Civilization = "civilization",
  Resource = "resource",
  Conflict = "conflict",
  Migration = "migration",
  Trade = "trade",
  Pollution = "pollution",
  Temperature = "temperature",
  Historical = "historical",
}

export enum GraphicsQuality {
  Ultra = "ultra",
  High = "high",
  Medium = "medium",
  PowerSaver = "power_saver",
}
