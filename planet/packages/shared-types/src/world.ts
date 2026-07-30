import type { BiomeType, CivRelation, GovernmentType, ResourceKind } from "./enums.js";

/** Metadata describing a planet grid (the heavy arrays live in the engine). */
export interface WorldMeta {
  id: string;
  name: string;
  seed: number;
  tick: number;
  year: number;
  /** Simulation years per tick. */
  yearsPerTick: number;
  gridWidth: number;
  gridHeight: number;
  createdAt: string;
  paused: boolean;
}

export interface RegionInfo {
  cellIndex: number;
  lat: number;
  lon: number;
  biome: BiomeType;
  height: number;
  temperature: number;
  moisture: number;
  pollution: number;
  fertility: number;
  river: boolean;
  civId?: number;
  cityId?: number;
  resources: { kind: ResourceKind; quantity: number }[];
  speciesCount: number;
  plantCount: number;
}

export interface SpeciesDTO {
  id: number;
  name: string;
  kind: "flora" | "fauna";
  population: number;
  originCell: number;
  cells: number[];
  diet: "herbivore" | "carnivore" | "omnivore" | "photosynthesis";
  size: number;
  intelligence: number;
  aggression: number;
  extinct: boolean;
  bornTick: number;
  contributionId?: string;
}

export interface CivilizationDTO {
  id: number;
  name: string;
  population: number;
  capitalCell: number;
  cells: number[];
  techLevel: number;
  government: GovernmentType;
  military: number;
  economy: number;
  stability: number;
  happiness: number;
  pollution: number;
  culture: string;
  language: string;
  fallen: boolean;
  foundedTick: number;
}

export interface CityDTO {
  id: number;
  name: string;
  civId: number;
  cell: number;
  population: number;
  foundedTick: number;
  fallen: boolean;
}

export interface TradeRouteDTO {
  id: number;
  fromCity: number;
  toCity: number;
  path: number[];
  active: boolean;
}

export interface WarDTO {
  id: number;
  attackerCiv: number;
  defenderCiv: number;
  startedTick: number;
  endedTick?: number;
  casualties: number;
  reason: string;
}

export interface AllianceDTO {
  id: number;
  civIds: number[];
  createdTick: number;
  brokenTick?: number;
}

export interface WorldStats {
  species: number;
  plants: number;
  civs: number;
  cities: number;
  technologies: number;
  activeWars: number;
  alliances: number;
  tradeRoutes: number;
  avgTemperature: number;
  avgPollution: number;
  totalPopulation: number;
}

export interface WorldSnapshotView {
  meta: WorldMeta;
  stats: WorldStats;
  civs: CivilizationDTO[];
  cities: CityDTO[];
  tradeRoutes: TradeRouteDTO[];
  wars: WarDTO[];
  alliances: AllianceDTO[];
  relations: { a: number; b: number; relation: CivRelation }[];
}
