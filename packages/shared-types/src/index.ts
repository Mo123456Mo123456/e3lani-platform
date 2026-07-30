/** Shared domain types for كوكب يولد أمامك */

export type Locale = "ar" | "en";
export type TextDirection = "rtl" | "ltr";

export type UserRole =
  | "visitor"
  | "user"
  | "explorer"
  | "life_maker"
  | "civilization_founder"
  | "historian"
  | "content_moderator"
  | "simulation_manager"
  | "system_admin"
  | "super_admin";

export type ContributionCategory =
  | "creature"
  | "plant"
  | "resource"
  | "civilization"
  | "city"
  | "invention"
  | "technology"
  | "disease"
  | "climate_phenomenon"
  | "natural_law"
  | "disaster"
  | "alliance"
  | "culture"
  | "language"
  | "transport"
  | "energy_source"
  | "custom";

export type BiomeType =
  | "ocean"
  | "coast"
  | "plains"
  | "rainforest"
  | "temperate_forest"
  | "desert"
  | "mountain"
  | "tundra"
  | "swamp"
  | "steppe"
  | "volcanic"
  | "ice";

export type WorldEventType =
  | "RESOURCE_DISCOVERED"
  | "SPECIES_CREATED"
  | "SPECIES_MUTATED"
  | "SPECIES_EXTINCT"
  | "PLANT_CREATED"
  | "PLANT_SPREAD"
  | "CIVILIZATION_FOUNDED"
  | "CITY_CREATED"
  | "TECHNOLOGY_DISCOVERED"
  | "WAR_STARTED"
  | "WAR_ENDED"
  | "MIGRATION_STARTED"
  | "MIGRATION_ENDED"
  | "ALLIANCE_CREATED"
  | "ALLIANCE_BROKEN"
  | "DISEASE_OUTBREAK"
  | "DISEASE_CONTAINED"
  | "CLIMATE_CHANGED"
  | "VOLCANO_ERUPTED"
  | "RESOURCE_DEPLETED"
  | "TRADE_ROUTE_CREATED"
  | "POLLUTION_SPIKE"
  | "POPULATION_BOOM"
  | "CONTRIBUTION_APPLIED"
  | "TICK_COMPLETED";

export type TickUnit = "day" | "month" | "year" | "decade";

export type GraphicsQuality = "ultra" | "high" | "medium" | "power_save";

export type PlanetLayer =
  | "surface"
  | "biome"
  | "weather"
  | "civilization"
  | "resource"
  | "conflict"
  | "migration"
  | "trade"
  | "pollution"
  | "temperature"
  | "historical";

export type CategoryColor =
  | "cyan"
  | "green"
  | "gold"
  | "purple"
  | "red"
  | "orange"
  | "white"
  | "gray"
  | "blue";

export const CATEGORY_COLORS: Record<ContributionCategory, CategoryColor> = {
  creature: "blue",
  plant: "green",
  resource: "cyan",
  civilization: "gold",
  city: "gold",
  invention: "cyan",
  technology: "cyan",
  disease: "red",
  climate_phenomenon: "blue",
  natural_law: "purple",
  disaster: "orange",
  alliance: "purple",
  culture: "purple",
  language: "purple",
  transport: "cyan",
  energy_source: "orange",
  custom: "white",
};

export const EVENT_COLORS: Partial<Record<WorldEventType, CategoryColor>> = {
  WAR_STARTED: "red",
  WAR_ENDED: "gold",
  SPECIES_CREATED: "blue",
  SPECIES_EXTINCT: "red",
  PLANT_CREATED: "green",
  PLANT_SPREAD: "green",
  CIVILIZATION_FOUNDED: "gold",
  CITY_CREATED: "gold",
  TECHNOLOGY_DISCOVERED: "cyan",
  MIGRATION_STARTED: "purple",
  ALLIANCE_CREATED: "purple",
  DISEASE_OUTBREAK: "red",
  CLIMATE_CHANGED: "blue",
  VOLCANO_ERUPTED: "orange",
  RESOURCE_DISCOVERED: "cyan",
  TRADE_ROUTE_CREATED: "gold",
  POLLUTION_SPIKE: "orange",
  CONTRIBUTION_APPLIED: "white",
};

export interface Vec2 {
  x: number;
  y: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RegionSummary {
  id: string;
  name: string;
  nameAr: string;
  biome: BiomeType;
  lat: number;
  lon: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  pollution: number;
  population: number;
  resources: number;
}

export interface PlanetSummary {
  id: string;
  name: string;
  nameAr: string;
  seed: number;
  ageYears: number;
  tick: number;
  tickUnit: TickUnit;
  civilizationCount: number;
  cityCount: number;
  speciesCount: number;
  plantCount: number;
  resourceCount: number;
  technologyCount: number;
  activeWars: number;
  activeMigrations: number;
  globalPollution: number;
  globalStability: number;
  globalTemperature: number;
}

export interface WorldEventDto {
  id: string;
  type: WorldEventType;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  tick: number;
  year: number;
  regionId?: string | null;
  importance: number;
  confidence: number;
  causes: string[];
  effects: string[];
  contributionId?: string | null;
  actorIds: string[];
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CausalLinkDto {
  id: string;
  fromEventId: string;
  toEventId: string;
  relation: string;
  strength: number;
  description: string;
  descriptionAr: string;
}

export interface ContributionTraits {
  size?: number;
  growthRate?: number;
  waterNeed?: number;
  foodNeed?: number;
  aggression?: number;
  intelligence?: number;
  coldResistance?: number;
  heatResistance?: number;
  pollutionAbsorption?: number;
  pollutionEmission?: number;
  energyOutput?: number;
  nightLuminosity?: number;
  fertilityBoost?: number;
  militaryPower?: number;
  economicValue?: number;
  contagiousness?: number;
  lethality?: number;
  adaptability?: number;
  mutationRate?: number;
  [key: string]: number | undefined;
}

export interface StructuredContribution {
  category: ContributionCategory;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  traits: ContributionTraits;
  possibleBiomes: BiomeType[];
  risks: string[];
  benefits: string[];
  balanceNotes: string[];
  wasBalanced: boolean;
  originalIdea: string;
}

export interface ImpactPreview {
  successProbability: number;
  suitableBiomes: BiomeType[];
  environmentalImpact: number;
  economicImpact: number;
  risks: string[];
  beneficiaryCivilizations: string[];
  shortTermEffects: string[];
  longTermEffects: string[];
}

export interface FutureScenario {
  horizonYears: number;
  label: "most_likely" | "best" | "worst";
  probability: number;
  summary: string;
  summaryAr: string;
  keyFactors: string[];
  metrics: Record<string, number>;
}

export interface UserImpactStats {
  elementsAdded: number;
  totalImpacts: number;
  civilizationsAffected: number;
  impactAgeDays: number;
  lastEventTitle?: string;
  lastEventTitleAr?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  level: number;
  xp: number;
  locale: Locale;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  messageAr?: string;
  details?: unknown;
}

/** Realtime WebSocket event envelopes */
export type RealtimeChannel =
  | "world.events"
  | "world.tick"
  | "contribution.status"
  | "notification"
  | "simulation.result"
  | "ai.status";

export interface RealtimeMessage<T = unknown> {
  channel: RealtimeChannel;
  type: string;
  payload: T;
  ts: string;
  planetId?: string;
}

export interface GraphicsSettings {
  quality: GraphicsQuality;
  clouds: boolean;
  atmosphere: boolean;
  particles: boolean;
  nightLights: boolean;
  shadows: boolean;
}

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  quality: "high",
  clouds: true,
  atmosphere: true,
  particles: true,
  nightLights: true,
  shadows: true,
};
