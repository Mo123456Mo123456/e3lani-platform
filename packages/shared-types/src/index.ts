/** Domain types for كوكب يولد أمامك — Planet Born Before You */

export type Role =
  | "visitor"
  | "user"
  | "explorer"
  | "life_maker"
  | "civ_creator"
  | "historian"
  | "content_mod"
  | "sim_manager"
  | "admin"
  | "super_admin";

export type ElementCategory =
  | "creature"
  | "plant"
  | "resource"
  | "civilization"
  | "invention"
  | "natural_phenomenon"
  | "disease"
  | "culture"
  | "world_law"
  | "custom";

export type ContributionStatus =
  | "draft"
  | "pending_analysis"
  | "pending_review"
  | "approved"
  | "rejected"
  | "integrated"
  | "archived";

export type BiomeId =
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

export type TickType = "day" | "month" | "year" | "decade";

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
  | "USER_ELEMENT_ADDED"
  | "GENESIS";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  contributionCount: number;
  reputation: number;
}

export interface Planet {
  id: string;
  name: string;
  seed: string;
  resolution: number;
  ageYears: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Region {
  id: string;
  planetId: string;
  name: string;
  biome: BiomeId;
  centerLat: number;
  centerLon: number;
  areaKm2: number;
  elevationMean: number;
  temperatureMean: number;
  moistureMean: number;
  neighbors: string[];
}

export interface Biome {
  id: BiomeId;
  name: string;
  nameAr: string;
  baseTempRange: [number, number];
  baseMoistureRange: [number, number];
  fertility: number;
  hostility: number;
}

export interface SpeciesTraits {
  size: number;
  speed: number;
  strength: number;
  intelligence: number;
  reproductionRate: number;
  lifespan: number;
  diet: "herbivore" | "carnivore" | "omnivore" | "producer";
  habitatPreference: BiomeId[];
  aggression: number;
  sociality: number;
  adaptability: number;
}

export interface Species {
  id: string;
  planetId: string;
  name: string;
  traits: SpeciesTraits;
  population: number;
  carryingCapacity: number;
  regionIds: string[];
  trophicLevel: number;
  preyIds: string[];
  predatorIds: string[];
  createdAtTick: number;
  contributionId?: string;
}

export interface Plant {
  id: string;
  planetId: string;
  name: string;
  growthRate: number;
  biomass: number;
  biomeIds: BiomeId[];
  nutrientValue: number;
  toxicity: number;
  contributionId?: string;
}

export interface Resource {
  id: string;
  planetId: string;
  name: string;
  category: "mineral" | "energy" | "organic" | "water" | "exotic";
  abundance: number;
  renewability: number;
  regionIds: string[];
  baseValue: number;
  contributionId?: string;
}

export interface Civilization {
  id: string;
  planetId: string;
  name: string;
  regionIds: string[];
  population: number;
  techLevel: number;
  militaryPower: number;
  economyStrength: number;
  cultureId?: string;
  languageId?: string;
  aggression: number;
  expansionism: number;
  diplomacy: number;
  foundedTick: number;
  contributionId?: string;
}

export interface City {
  id: string;
  civilizationId: string;
  regionId: string;
  name: string;
  population: number;
  foundedTick: number;
  isCapital: boolean;
}

export interface Technology {
  id: string;
  name: string;
  tier: number;
  prerequisites: string[];
  effects: Record<string, number>;
  discoveredBy?: string;
  discoveredTick?: number;
  contributionId?: string;
}

export interface Culture {
  id: string;
  civilizationId: string;
  name: string;
  values: Record<string, number>;
  traditions: string[];
  contributionId?: string;
}

export interface Language {
  id: string;
  name: string;
  civilizationIds: string[];
  complexity: number;
  contributionId?: string;
}

export interface TradeRoute {
  id: string;
  fromRegionId: string;
  toRegionId: string;
  civilizationIds: string[];
  goods: string[];
  volume: number;
  cost: number;
  createdTick: number;
}

export interface Alliance {
  id: string;
  civilizationIds: string[];
  strength: number;
  createdTick: number;
  expiredTick?: number;
}

export interface War {
  id: string;
  attackerId: string;
  defenderId: string;
  startedTick: number;
  endedTick?: number;
  outcome?: "attacker_win" | "defender_win" | "stalemate" | "truce";
  casualties: number;
  regionIds: string[];
}

export interface Disease {
  id: string;
  name: string;
  infectivity: number;
  lethality: number;
  affectedSpeciesIds: string[];
  regionIds: string[];
  startedTick: number;
  contributionId?: string;
}

export interface Migration {
  id: string;
  speciesOrCivId: string;
  kind: "species" | "civilization";
  fromRegionId: string;
  toRegionId: string;
  population: number;
  startedTick: number;
  completedTick?: number;
}

export interface UserContribution {
  id: string;
  userId: string;
  planetId: string;
  category: ElementCategory;
  title: string;
  description: string;
  traits: Record<string, unknown>;
  status: ContributionStatus;
  moderationNotes?: string;
  createdAt: string;
  updatedAt: string;
  integratedTick?: number;
}

export interface SimulationTick {
  tick: number;
  tickType: TickType;
  planetId: string;
  yearEquivalent: number;
  timestamp: string;
}

export interface CausalLink {
  fromEventId: string;
  toEventId: string;
  weight: number;
  type: "causes" | "enables" | "amplifies" | "inhibits" | "triggers";
}

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  tick: number;
  causeIds: string[];
  regionId?: string;
  contributionId?: string;
  payload: Record<string, unknown>;
  confidence: number;
  directEffects: string[];
  narrativeHints: string[];
}

export interface TimelineSnapshot {
  id: string;
  planetId: string;
  tick: number;
  label: string;
  stateHash: string;
  eventCount: number;
  createdAt: string;
}

export interface AIRequest {
  id: string;
  kind: "analyze_element" | "generate_narrative" | "forecast" | "moderate" | "balance";
  input: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  result?: Record<string, unknown>;
  createdAt: string;
}

export interface ModerationResult {
  contributionId: string;
  approved: boolean;
  score: number;
  flags: string[];
  notes: string;
  reviewerId?: string;
  reviewedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  kind: "system" | "contribution" | "simulation" | "moderation";
  read: boolean;
  createdAt: string;
  linkUrl?: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RegionSummary {
  id: string;
  biome: BiomeId;
  elevMean: number;
  tempMean: number;
  moistMean: number;
  landFraction: number;
}

export interface ForecastScenario {
  label: "mostLikely" | "best" | "worst";
  events: WorldEvent[];
  metrics: Record<string, number>;
  probability: number;
}

export interface ForecastResult {
  years: number;
  monteCarloRuns: number;
  mostLikely: ForecastScenario;
  best: ForecastScenario;
  worst: ForecastScenario;
  uncertainty: number;
}
