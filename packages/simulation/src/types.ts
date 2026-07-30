import type {
  AllianceStatus,
  BiomeType,
  ContributionCategory,
  GovernmentType,
  ParsedContribution,
  PlantTraits,
  ResourceKind,
  SpeciesTraits,
  TechEra,
  WarStatus,
  WorldEvent,
} from "@kawkab/shared-types";

export interface ResourceDepositState {
  kind: ResourceKind;
  amount: number; // 0..1 relative
  renewalRate: number; // per year 0..1
  discovered: boolean;
}

export interface CellState {
  index: number;
  elevation: number; // -1..1, >0 = land (sea level 0)
  isOcean: boolean;
  isVolcanic: boolean;
  hasIce: boolean;
  temperature: number; // °C annual mean
  moisture: number; // 0..1
  fertility: number; // 0..1
  pollution: number; // 0..1
  biome: BiomeType;
  river: number; // 0..1 flow strength
  flowTo: number; // downhill neighbour index or -1
  plateId: number;
  ownerCivId: string | null;
  cityId: string | null;
  population: number; // civilised population
  plantCoverage: number; // 0..1
  resources: ResourceDepositState[];
  // transient (recomputed each tick, not part of identity hash of terrain)
  storm: number; // 0..1 active storm intensity
  droughtTicks: number;
  fire: number; // 0..1
}

export interface CityStateInternal {
  id: string;
  name: string;
  civId: string;
  cellIndex: number;
  population: number;
  foundedTick: number;
  isCapital: boolean;
  health: number; // 0..1
  prosperity: number; // 0..1
}

export interface CivStateInternal {
  id: string;
  name: string;
  color: string;
  foundedTick: number;
  population: number;
  territory: Set<number>;
  cityIds: string[];
  capitalCityId: string | null;
  techKeys: Set<string>;
  techEra: TechEra;
  government: GovernmentType;
  military: number; // 0..1 strength
  stability: number; // 0..1
  happiness: number; // 0..1
  health: number; // 0..1
  education: number; // 0..1
  economy: number; // 0..1
  foodSecurity: number; // 0..1
  aggression: number; // 0..1
  innovation: number; // 0..1
  pollutionPerCapita: number;
  stockpiles: Partial<Record<ResourceKind, number>>;
  relations: Record<string, number>; // civId -> -1..1
  memory: string[]; // event ids that shaped decisions (grievances, alliances)
  researchProgress: number;
  actionCooldowns: Record<string, number>; // action -> tick available again
  extinct: boolean;
  cultureName: string;
  languageName: string;
  languageFamily: string;
}

export interface SpeciesStateInternal {
  id: string;
  name: string;
  parentId: string | null;
  originContributionId: string | null;
  homeBiome: BiomeType;
  traits: SpeciesTraits;
  diet: "plants" | "meat" | "omnivore";
  preyIds: string[];
  createdTick: number;
  /** id of the event that introduced this species (causal anchor) */
  createdEventId?: string;
  extinct: boolean;
  extinctTick: number | null;
}

export interface PlantStateInternal {
  id: string;
  name: string;
  originContributionId: string | null;
  biomes: BiomeType[];
  traits: PlantTraits;
  createdTick: number;
  /** id of the event that introduced this plant (causal anchor) */
  createdEventId?: string;
  extinct: boolean;
  /** explicit colonised cells (contribution plants spread dynamically) */
  cells: Set<number>;
  /** for catalogue flora: estimated coverage when not cell-tracked */
  estimatedCoverage: number;
}

export interface TechNode {
  key: string;
  name: string;
  era: TechEra;
  prereqKeys: string[];
  /** 0..1 research cost */
  cost: number;
  effects: Partial<Record<"farming" | "seafaring" | "medicine" | "industry" | "military" | "logistics" | "energy" | "science", number>>;
}

export interface TradeRouteInternal {
  id: string;
  fromCityId: string;
  toCityId: string;
  path: number[];
  goods: ResourceKind[];
  value: number;
  risk: number;
  active: boolean;
  createdTick: number;
}

export interface AllianceInternal {
  id: string;
  name: string;
  memberCivIds: string[];
  status: AllianceStatus;
  createdTick: number;
  brokenTick: number | null;
}

export interface WarInternal {
  id: string;
  name: string;
  attackerCivId: string;
  defenderCivId: string;
  status: WarStatus;
  startedTick: number;
  endedTick: number | null;
  casualties: number;
  frontCells: Set<number>;
  momentum: number; // -1..1, >0 attacker winning
  causeEventId: string;
  causeSummary: string;
}

export interface DiseaseInternal {
  id: string;
  name: string;
  originContributionId: string | null;
  severity: number;
  contagiousness: number;
  affectedCivIds: Set<string>;
  startedTick: number;
  contained: boolean;
  cells: Set<number>;
}

export interface MigrationInternal {
  id: string;
  civId: string | null;
  speciesId: string | null;
  fromIndex: number;
  toIndex: number;
  path: number[];
  size: number;
  startedTick: number;
  completedTick: number | null;
  progress: number; // 0..1 along path
  causeEventId: string;
}

export interface PendingContribution {
  id: string;
  userId: string;
  category: ContributionCategory;
  parsed: ParsedContribution;
  originIndex: number;
  applyTick: number;
}

export interface WorldLaws {
  warProbabilityMultiplier: number;
  climateSensitivityMultiplier: number;
}

/** persistent regional climate modifier introduced by a contribution */
export interface PhenomenonState {
  id: string;
  contributionId: string;
  centerIndex: number;
  radius: number;
  moistureDelta: number;
  tempDelta: number;
  stormBoost: number;
  /** 0..1, decays slowly */
  strength: number;
  eventId: string;
}

export interface WorldState {
  seed: string;
  tick: number;
  /** simulated years since formation (history is synthesised before tick 0) */
  simYear: number;
  gridWidth: number;
  gridHeight: number;
  cells: CellState[];
  species: Map<string, SpeciesStateInternal>;
  speciesPops: Map<string, Map<number, number>>;
  plants: Map<string, PlantStateInternal>;
  civs: Map<string, CivStateInternal>;
  cities: Map<string, CityStateInternal>;
  techTree: TechNode[];
  tradeRoutes: Map<string, TradeRouteInternal>;
  alliances: Map<string, AllianceInternal>;
  wars: Map<string, WarInternal>;
  diseases: Map<string, DiseaseInternal>;
  migrations: Map<string, MigrationInternal>;
  laws: WorldLaws;
  phenomena: PhenomenonState[];
  globalTempAnomaly: number; // °C vs baseline
  volcanicAerosol: number; // 0..1 cooling effect
  pendingContributions: PendingContribution[];
}

export interface EngineEvent extends WorldEvent {}

export interface EngineConfig {
  gridWidth: number;
  gridHeight: number;
  seaLevel: number;
  snapshotInterval: number;
  yearsPerTick: number;
}
