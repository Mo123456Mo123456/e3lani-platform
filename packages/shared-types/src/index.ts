/** Shared domain types for كوكب يولد أمامك */

export type Locale = "ar" | "en";
export type TextDirection = "rtl" | "ltr";

export type UserRole =
  | "guest"
  | "user"
  | "explorer"
  | "life_maker"
  | "civilization_creator"
  | "historian"
  | "content_moderator"
  | "simulation_manager"
  | "system_admin"
  | "super_admin";

export type ElementCategory =
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
  | "energy"
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
  | "wetland"
  | "steppe"
  | "volcanic"
  | "ice";

export type WorldEventType =
  | "RESOURCE_DISCOVERED"
  | "SPECIES_CREATED"
  | "SPECIES_MUTATED"
  | "SPECIES_EXTINCT"
  | "CIVILIZATION_FOUNDED"
  | "CITY_CREATED"
  | "TECHNOLOGY_DISCOVERED"
  | "WAR_STARTED"
  | "WAR_ENDED"
  | "MIGRATION_STARTED"
  | "ALLIANCE_CREATED"
  | "DISEASE_OUTBREAK"
  | "CLIMATE_CHANGED"
  | "VOLCANO_ERUPTED"
  | "RESOURCE_DEPLETED"
  | "TRADE_ROUTE_CREATED"
  | "PLANT_SPREAD"
  | "POLLUTION_CHANGED"
  | "CONTRIBUTION_APPLIED"
  | "TICK_COMPLETED";

export type GraphicsQuality = "ultra" | "high" | "medium" | "power_saver";

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

export type TickUnit = "day" | "month" | "year" | "decade";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface ElementTraits {
  size: number;
  growthRate: number;
  waterNeed: number;
  heatResistance: number;
  coldResistance: number;
  aggression?: number;
  intelligence?: number;
  pollutionAbsorption?: number;
  nightLuminosity?: number;
  energyOutput?: number;
  fertility?: number;
  adaptability?: number;
  [key: string]: number | undefined;
}

export interface StructuredElement {
  category: ElementCategory;
  name: string;
  nameAr?: string;
  nameEn?: string;
  description: string;
  traits: ElementTraits;
  possibleBiomes: BiomeType[];
  risks: string[];
  benefits: string[];
  balanceScore: number;
  wasBalanced: boolean;
  balanceNotes?: string[];
}

export interface CausalNode {
  id: string;
  label: string;
  kind: "cause" | "direct" | "secondary" | "long_term" | "event";
  magnitude: number;
  confidence: number;
  tickOffset: number;
}

export interface CausalEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
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
  importance: number;
  regionId?: string;
  lat?: number;
  lon?: number;
  causeIds: string[];
  contributionId?: string;
  userId?: string;
  confidence: number;
  directImpact: Record<string, number>;
  thumbnailUrl?: string;
  createdAt: string;
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
  population: number;
  pollution: number;
  resourceCount: number;
  civilizationId?: string;
}

export interface CivilizationSummary {
  id: string;
  name: string;
  nameAr: string;
  population: number;
  techLevel: number;
  military: number;
  economy: number;
  stability: number;
  happiness: number;
  pollution: number;
  color: string;
  capitalCityId?: string;
}

export interface UserImpactStats {
  elementsAdded: number;
  totalImpacts: number;
  evolutionDays: number;
  civilizationsAffected: number;
  lastEventTitle?: string;
  lastEventTitleAr?: string;
}

export interface ScenarioForecast {
  horizonYears: number;
  mostLikely: string;
  mostLikelyAr: string;
  bestCase: string;
  bestCaseAr: string;
  worstCase: string;
  worstCaseAr: string;
  uncertainty: number;
  keyFactors: string[];
  keyFactorsAr: string[];
}

export interface PlanetOverlayMarker {
  id: string;
  category: ElementCategory | "weather" | "disaster" | "war" | "migration" | "invention";
  label: string;
  labelAr: string;
  value: string;
  valueAr: string;
  lat: number;
  lon: number;
  color: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  level: number;
  xp: number;
  locale: Locale;
  avatarUrl?: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  code?: string;
  details?: unknown;
}

/** Realtime delta payload — never full planet state */
export interface RealtimeDelta {
  type: "event" | "tick" | "contribution" | "notification" | "ai_status" | "layer";
  planetId: string;
  tick?: number;
  payload: Record<string, unknown>;
  ts: string;
}

export const ELEMENT_CATEGORIES: ElementCategory[] = [
  "creature",
  "plant",
  "resource",
  "civilization",
  "invention",
  "climate_phenomenon",
  "disease",
  "culture",
  "natural_law",
  "custom",
];

export const BIOME_TYPES: BiomeType[] = [
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
];
