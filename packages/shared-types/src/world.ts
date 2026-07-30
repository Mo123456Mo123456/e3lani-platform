import type {
  AllianceStatus,
  BiomeType,
  GovernmentType,
  ResourceKind,
  TechEra,
  WarStatus,
} from "./enums.js";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface GridRef extends GeoPoint {
  x: number;
  y: number;
  index: number;
}

/** Public, serialisable view of one planetary cell ("region"). */
export interface RegionData {
  index: number;
  x: number;
  y: number;
  lat: number;
  lon: number;
  /** metres above/below sea level, normalised -1..1 */
  elevation: number;
  /** annual mean temperature, °C */
  temperature: number;
  /** 0..1 */
  moisture: number;
  biome: BiomeType;
  /** 0..1 soil/surface fertility */
  fertility: number;
  /** 0..1 */
  pollution: number;
  /** 0..1 river flow strength, 0 = none */
  river: number;
  isOcean: boolean;
  isVolcanic: boolean;
  hasIce: boolean;
  ownerCivId: string | null;
  cityId: string | null;
  /** inhabitants of the cell (civilised population) */
  population: number;
  plantCoverage: number;
  resources: Array<{ kind: ResourceKind; amount: number }>;
}

export interface ResourceDeposit {
  kind: ResourceKind;
  /** remaining amount 0..1 relative to initial */
  amount: number;
  /** replenishment per year 0..1 */
  renewalRate: number;
  discovered: boolean;
}

export interface CityState {
  id: string;
  name: string;
  civId: string;
  cellIndex: number;
  lat: number;
  lon: number;
  population: number;
  foundedTick: number;
  isCapital: boolean;
  health: number;
  prosperity: number;
}

export interface TechnologyState {
  id: string;
  key: string;
  name: string;
  era: TechEra;
  prereqKeys: string[];
  /** civ ids that discovered it */
  discoveredBy: string[];
  discoveredTick: number | null;
}

export interface CultureState {
  id: string;
  name: string;
  civId: string;
  values: Record<string, number>;
  influence: number;
}

export interface LanguageState {
  id: string;
  name: string;
  civId: string;
  speakers: number;
  family: string;
}

export interface CivilizationState {
  id: string;
  name: string;
  color: string;
  foundedTick: number;
  capitalCityId: string | null;
  population: number;
  territorySize: number;
  techEra: TechEra;
  techKeys: string[];
  government: GovernmentType;
  military: number;
  stability: number;
  happiness: number;
  health: number;
  education: number;
  pollution: number;
  economy: number;
  foodSecurity: number;
  aggression: number;
  innovation: number;
  extinct: boolean;
  cultureId: string | null;
  languageId: string | null;
}

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
}

export interface SpeciesState {
  id: string;
  name: string;
  parentId: string | null;
  originContributionId: string | null;
  homeBiome: BiomeType;
  traits: SpeciesTraits;
  diet: "plants" | "meat" | "omnivore";
  preyIds: string[];
  globalPopulation: number;
  cellCount: number;
  createdTick: number;
  extinct: boolean;
  extinctTick: number | null;
}

export interface PlantTraits {
  size: number;
  growthRate: number;
  waterNeed: number;
  heatResistance: number;
  coldResistance: number;
  pollutionAbsorption: number;
  energyStorage: number;
  luminosity: number;
  toxicity: number;
  spreadRate: number;
}

export interface PlantState {
  id: string;
  name: string;
  originContributionId: string | null;
  biomes: BiomeType[];
  traits: PlantTraits;
  /** number of cells currently colonised */
  coverage: number;
  createdTick: number;
  extinct: boolean;
}

export interface TradeRouteState {
  id: string;
  fromCityId: string;
  toCityId: string;
  fromCivId: string;
  toCivId: string;
  /** polyline of grid refs for rendering */
  path: GeoPoint[];
  goods: ResourceKind[];
  value: number;
  risk: number;
  active: boolean;
  createdTick: number;
}

export interface AllianceState {
  id: string;
  memberCivIds: string[];
  name: string;
  status: AllianceStatus;
  createdTick: number;
  brokenTick: number | null;
}

export interface WarState {
  id: string;
  name: string;
  attackerCivId: string;
  defenderCivId: string;
  status: WarStatus;
  startedTick: number;
  endedTick: number | null;
  casualties: number;
  /** contested cells */
  frontCells: GeoPoint[];
  causeSummary: string;
}

export interface DiseaseState {
  id: string;
  name: string;
  originContributionId: string | null;
  severity: number;
  contagiousness: number;
  affectedCivIds: string[];
  startedTick: number;
  contained: boolean;
}

export interface MigrationStreamState {
  id: string;
  civId: string | null;
  speciesId: string | null;
  from: GeoPoint;
  to: GeoPoint;
  path: GeoPoint[];
  size: number;
  startedTick: number;
  completedTick: number | null;
}

export interface PlanetStats {
  tick: number;
  simYear: number;
  civilizations: number;
  cities: number;
  species: number;
  plants: number;
  totalPopulation: number;
  meanTemperature: number;
  meanPollution: number;
  activeWars: number;
  activeDiseases: number;
  tradeRoutes: number;
}

export interface PlanetConfig {
  seed: string;
  gridWidth: number;
  gridHeight: number;
  seaLevel: number;
  tickDuration: import("./enums.js").TickDuration;
  snapshotInterval: number;
}

export interface PlanetSummary {
  id: string;
  name: string;
  seed: string;
  config: PlanetConfig;
  stats: PlanetStats;
  createdAt: string;
}

export interface TimelineEntry {
  tick: number;
  simYear: number;
  type: import("./enums.js").WorldEventType;
  title: string;
  magnitude: number;
}

/** Delta update pushed over WebSocket; never the full state. */
export interface WorldDelta {
  planetId: string;
  fromTick: number;
  toTick: number;
  simYear: number;
  changedRegions: Array<Partial<RegionData> & { index: number }>;
  newEvents: import("./events.js").WorldEvent[];
  stats: PlanetStats;
}

export interface LayerCellPayload {
  index: number;
  value: number;
  color?: string;
}

export interface LayerPayload {
  layer: import("./enums.js").LayerId;
  cells: LayerCellPayload[];
  legend: Array<{ color: string; labelKey: string }>;
}
