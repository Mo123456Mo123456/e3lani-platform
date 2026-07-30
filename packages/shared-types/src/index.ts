/**
 * @planet/shared-types
 * Canonical vocabulary shared by the web apps, the API, and the simulation
 * engine. Everything that crosses a process boundary is typed here.
 */

// ---------------------------------------------------------------------------
// Geography & biomes
// ---------------------------------------------------------------------------

export const BIOMES = [
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
export type Biome = (typeof BIOMES)[number];

export const RESOURCE_TYPES = [
  "fresh_water",
  "fertile_soil",
  "timber",
  "iron",
  "copper",
  "gold",
  "coal",
  "oil",
  "uranium",
  "crystal",
  "fish",
  "grain",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** A single grid cell of the procedural planet. Quantized for transport. */
export interface PlanetCell {
  index: number;
  /** degrees, -90..90 */
  lat: number;
  /** degrees, -180..180 */
  lon: number;
  /** -1..1, negative means below sea level */
  height: number;
  /** 0..1 */
  temperature: number;
  /** 0..1 */
  moisture: number;
  biome: Biome;
  /** 0..1 soil fertility */
  fertility: number;
  /** 0..1 current pollution */
  pollution: number;
  river: boolean;
  volcanic: boolean;
  /** civilization id that owns this cell, null = unclaimed */
  ownerId: string | null;
  resources: ResourceDeposit[];
}

export interface ResourceDeposit {
  id: string;
  type: ResourceType;
  /** remaining quantity in abstract units */
  quantity: number;
  /** fraction restored per tick 0..1 */
  renewRate: number;
  /** relative economic value 0..1 */
  value: number;
  discovered: boolean;
}

export interface PlanetSummary {
  id: string;
  name: string;
  seed: string;
  latBands: number;
  lonBands: number;
  seaLevel: number;
  currentTick: number;
  currentYear: number;
  yearsPerTick: number;
  status: "running" | "paused";
  stats: PlanetStats;
  createdAt: string;
}

export interface PlanetStats {
  landCells: number;
  oceanCells: number;
  biomeCounts: Partial<Record<Biome, number>>;
  civilizationCount: number;
  cityCount: number;
  speciesCount: number;
  plantCount: number;
  resourceDepositCount: number;
  activeWarCount: number;
  eventCount: number;
}

// ---------------------------------------------------------------------------
// Life
// ---------------------------------------------------------------------------

/** All trait values are normalized to 0..1 unless stated otherwise. */
export interface SpeciesTraits {
  size: number;
  lifespan: number;
  reproductionRate: number;
  heatResistance: number;
  coldResistance: number;
  waterNeed: number;
  intelligence: number;
  aggression: number;
  mobility: number;
  adaptability: number;
  mutationRate: number;
  /** true for producer-like creatures (e.g. photosynthetic) */
  photosynthetic?: boolean;
  aquatic?: boolean;
}

export interface PlantTraits {
  size: number;
  growthRate: number;
  waterNeed: number;
  pollutionAbsorption: number;
  nightLuminosity: number;
  coldResistance: number;
  heatResistance: number;
  /** energy stored per unit biomass, drives industrial value */
  energyStorage?: number;
  toxicity?: number;
}

export type Diet = "herbivore" | "carnivore" | "omnivore" | "producer";

export interface Species {
  id: string;
  name: string;
  diet: Diet;
  traits: SpeciesTraits;
  /** species ids this one preys on */
  preyIds: string[];
  population: number;
  /** cell indexes where populations exist (weighted) */
  habitat: number[];
  originCell: number;
  bornAtTick: number;
  extinctAtTick: number | null;
  parentSpeciesId: string | null;
  originContributionId: string | null;
}

export interface Plant {
  id: string;
  name: string;
  traits: PlantTraits;
  suitableBiomes: Biome[];
  /** cell index -> coverage 0..1 */
  coverage: Record<number, number>;
  bornAtTick: number;
  originContributionId: string | null;
}

// ---------------------------------------------------------------------------
// Civilizations
// ---------------------------------------------------------------------------

export type Government =
  | "tribal"
  | "monarchy"
  | "republic"
  | "theocracy"
  | "technocracy";

export interface Civilization {
  id: string;
  name: string;
  color: string;
  population: number;
  cityIds: string[];
  cultureId: string;
  languageId: string;
  government: Government;
  /** 0..1 normalized tech progress along the registry */
  techLevel: number;
  discoveredTechIds: string[];
  military: number;
  food: number;
  economy: number;
  health: number;
  stability: number;
  education: number;
  happiness: number;
  pollution: number;
  /** 0..1 */
  aggression: number;
  innovation: number;
  /** civId -> relation -1..1 */
  relations: Record<string, number>;
  /** remembered grievances: civId -> accumulated harm 0..1 */
  memory: Record<string, number>;
  foundedAtTick: number;
  collapsedAtTick: number | null;
  originContributionId: string | null;
}

export interface City {
  id: string;
  name: string;
  civId: string;
  cell: number;
  population: number;
  foundedAtTick: number;
  destroyedAtTick: number | null;
}

export interface Technology {
  id: string;
  name: string;
  /** position in the seeded tech order; 0 = first */
  tier: number;
  effects: Record<string, number>;
}

export interface Culture {
  id: string;
  name: string;
  values: Record<string, number>;
}

export interface Language {
  id: string;
  name: string;
  family: string;
}

export interface TradeRoute {
  id: string;
  fromCityId: string;
  toCityId: string;
  /** ordered cell path */
  path: number[];
  volume: number;
  createdAtTick: number;
  active: boolean;
}

export interface Alliance {
  id: string;
  memberCivIds: string[];
  createdAtTick: number;
  dissolvedAtTick: number | null;
  reason: string;
}

export interface War {
  id: string;
  attackerCivId: string;
  defenderCivId: string;
  startedAtTick: number;
  endedAtTick: number | null;
  cause: string;
  battles: number;
  casualties: number;
}

export interface Disease {
  id: string;
  name: string;
  severity: number;
  contagiousness: number;
  originCell: number;
  affectedCivIds: string[];
  startedAtTick: number;
  endedAtTick: number | null;
}

export interface Migration {
  id: string;
  civId: string | null;
  speciesId: string | null;
  fromCell: number;
  toCell: number;
  path: number[];
  people: number;
  startedAtTick: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Contributions (user additions)
// ---------------------------------------------------------------------------

export const CONTRIBUTION_CATEGORIES = [
  "creature",
  "plant",
  "resource",
  "civilization",
  "invention",
  "phenomenon",
  "disease",
  "culture",
  "law",
  "custom",
] as const;
export type ContributionCategory = (typeof CONTRIBUTION_CATEGORIES)[number];

/**
 * Structured form of a user contribution. Produced from free text by the AI
 * orchestrator (or the offline sandbox analyzer), validated before anything
 * touches the engine.
 */
export interface StructuredContribution {
  category: ContributionCategory;
  name: string;
  description: string;
  traits: Record<string, number>;
  possibleBiomes: Biome[];
  risks: string[];
}

export interface BalanceViolation {
  code: string;
  message: string;
  severity: "block" | "nerf";
}

export interface BalanceReport {
  balanced: boolean;
  violations: BalanceViolation[];
  /** auto-corrected version when violations are nerfable */
  suggested: StructuredContribution | null;
  powerScore: number;
}

export interface Contribution {
  id: string;
  userId: string;
  planetId: string;
  rawText: string;
  structured: StructuredContribution;
  balance: BalanceReport;
  originCell: number;
  status: "analyzed" | "placed" | "rejected";
  createdAtTick: number;
  createdAt: string;
  impactScore: number;
}

// ---------------------------------------------------------------------------
// Events, causality, timeline
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  "WORLD_GENESIS",
  "RESOURCE_DISCOVERED",
  "RESOURCE_DEPLETED",
  "SPECIES_CREATED",
  "SPECIES_MUTATED",
  "SPECIES_MIGRATED",
  "SPECIES_EXTINCT",
  "PLANT_SPREAD",
  "CIVILIZATION_FOUNDED",
  "CIVILIZATION_COLLAPSED",
  "GOVERNMENT_CHANGED",
  "CITY_CREATED",
  "CITY_DESTROYED",
  "TECHNOLOGY_DISCOVERED",
  "WAR_STARTED",
  "WAR_ENDED",
  "MIGRATION_STARTED",
  "ALLIANCE_CREATED",
  "ALLIANCE_DISSOLVED",
  "DISEASE_OUTBREAK",
  "DISEASE_CONTAINED",
  "CLIMATE_CHANGED",
  "DROUGHT_STARTED",
  "WILDFIRE_STARTED",
  "FLOOD_OCCURRED",
  "VOLCANO_ERUPTED",
  "TRADE_ROUTE_CREATED",
  "CONTRIBUTION_PLACED",
  "POLLUTION_CRITICAL",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface WorldEvent {
  id: string;
  planetId: string;
  tick: number;
  year: number;
  type: EventType;
  /** primary cell index, -1 for global */
  cell: number;
  /** event/contribution ids that directly caused this event */
  causeIds: string[];
  /** human-readable causal explanation key/data */
  cause: string;
  actors: { kind: string; id: string; name: string }[];
  data: Record<string, number | string | boolean>;
  /** 0..1 how certain the engine is about downstream attribution */
  confidence: number;
  /** 0..1 display importance */
  importance: number;
  /** user whose contribution ultimately originated this, when traceable */
  originUserId: string | null;
  originContributionId: string | null;
}

export interface CausalLink {
  id: string;
  planetId: string;
  fromId: string;
  toId: string;
  weight: number;
  mechanism: string;
}

export interface TimelineSnapshot {
  id: string;
  planetId: string;
  tick: number;
  year: number;
  /** serialized engine state */
  state: unknown;
  eventCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Scenarios ("what happens after your addition")
// ---------------------------------------------------------------------------

export interface ScenarioRequest {
  horizonTicks: number;
  runs: number;
}

export interface ScenarioOutcome {
  runIndex: number;
  /** objective score of this branch, 0..1 */
  score: number;
  survivalOfContribution: boolean;
  keyEvents: WorldEvent[];
  endState: Record<string, number>;
}

export interface ScenarioReport {
  mostLikely: ScenarioOutcome;
  best: ScenarioOutcome;
  worst: ScenarioOutcome;
  /** 0..1, higher = less predictable */
  uncertainty: number;
  decisiveFactors: string[];
  runs: number;
  horizonTicks: number;
}

// ---------------------------------------------------------------------------
// Users, auth, moderation, notifications
// ---------------------------------------------------------------------------

export const ROLES = [
  "visitor",
  "user",
  "explorer",
  "life_maker",
  "civilization_builder",
  "historian",
  "moderator",
  "simulation_admin",
  "admin",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  provider: "email" | "google" | "apple";
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ModerationResult {
  id: string;
  targetId: string;
  verdict: "allow" | "review" | "block";
  reasons: string[];
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  eventId: string | null;
  read: boolean;
  createdAt: string;
}

export interface AIRequestLog {
  id: string;
  provider: string;
  kind: "parse" | "balance" | "narrate";
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Realtime protocol (WebSocket)
// ---------------------------------------------------------------------------

export type RealtimeMessage =
  | { kind: "hello"; planetId: string; tick: number; year: number }
  | { kind: "tick"; tick: number; year: number }
  | { kind: "events"; events: WorldEvent[] }
  | { kind: "delta"; changes: StateDelta }
  | { kind: "notification"; notification: Notification }
  | { kind: "contribution"; contribution: Contribution };

/** Incremental world-state update; full state is never re-sent. */
export interface StateDelta {
  tick: number;
  /** cell index -> changed scalar fields */
  cells: Record<number, Partial<Pick<PlanetCell, "ownerId" | "pollution" | "temperature" | "moisture">>>;
  newCities: City[];
  destroyedCityIds: string[];
  newSpecies: Species[];
  extinctSpeciesIds: string[];
  newTradeRoutes: TradeRoute[];
  activeWarIds: string[];
  stats: PlanetStats;
}

// ---------------------------------------------------------------------------
// Layer ids for the 3D renderer
// ---------------------------------------------------------------------------

export const RENDER_LAYERS = [
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
] as const;
export type RenderLayer = (typeof RENDER_LAYERS)[number];

export type Locale = "ar" | "en";
