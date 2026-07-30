/** World-domain DTOs served by the API. */

export const BIOMES = [
  "ocean", "coast", "plains", "grassland", "savanna", "rainforest",
  "temperate_forest", "boreal_forest", "desert", "steppe", "tundra",
  "ice", "mountain", "volcanic", "swamp",
] as const;
export type Biome = (typeof BIOMES)[number];

export const MAP_LAYERS = [
  "height", "biome", "temperature", "moisture", "pollution",
  "political", "vegetation", "nightlights",
] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

export interface PlanetSummary {
  id: string;
  name: string;
  seed: number;
  tick: number;
  yearsPerTick: number;
  status: "running" | "paused";
  civilizations: number;
  cities: number;
  species: number;
  plants: number;
  technologies: number;
  activeWars: number;
  eventCount: number;
  globalTempShift: number;
  stateHash: string | null;
  createdAt: string;
}

export interface RegionInfo {
  cellId: number;
  lat: number;
  lon: number;
  biome: Biome;
  temp: number;
  moisture: number;
  fertility: number;
  pollution: number;
  vegetation: number;
  freshwater: boolean;
  ownerCivId: string | null;
  ownerCivName: string | null;
  cityId: string | null;
  cityName: string | null;
  deposits: Record<string, number>;
  presentPlants: number;
  presentSpecies: number;
}

export interface CivilizationDto {
  id: string;
  name: string;
  culture: string;
  language: string;
  government: string;
  population: number;
  techLevel: number;
  military: number;
  treasury: number;
  happiness: number;
  health: number;
  stability: number;
  education: number;
  cities: number;
  territoryCells: number;
  extinct: boolean;
  contributionId: string | null;
}

export interface CivilizationDetail extends CivilizationDto {
  cityList: CityDto[];
  relationships: Array<{ civId: string; civName: string; trust: number; atWar: boolean; allied: boolean; trade: boolean }>;
  memory: string[];
}

export interface CityDto {
  id: string;
  civId: string;
  civName: string;
  cellId: number;
  lat: number;
  lon: number;
  name: string;
  population: number;
  foundedTick: number;
}

export interface SpeciesDto {
  id: string;
  name: string;
  diet: string;
  size: number;
  totalPopulation: number;
  cellCount: number;
  extinct: boolean;
  parentId: string | null;
  contributionId: string | null;
}

export interface PlantDto {
  id: string;
  name: string;
  homeBiome: string;
  cellCount: number;
  extinct: boolean;
  contributionId: string | null;
  traits: Record<string, number>;
}

export interface TechnologyDto {
  id: string;
  name: string;
  tier: number;
  discoveredBy: string | null;
  discoveredByName: string | null;
  tick: number | null;
  contributionId: string | null;
}

export interface AllianceDto {
  id: string;
  members: string[];
  memberNames: string[];
  formedTick: number;
  active: boolean;
}

export interface WarDto {
  id: string;
  attacker: string;
  attackerName: string;
  defender: string;
  defenderName: string;
  startTick: number;
  active: boolean;
  causes: Array<{ factor: string; weight: number }>;
  fronts: number[];
}

export interface TradeRouteDto {
  id: string;
  civA: string;
  civB: string;
  civAName: string;
  civBName: string;
  commodity: string;
  path: number[];
  volume: number;
  active: boolean;
}

export interface TimelineEra {
  fromTick: number;
  toTick: number;
  label: string;
  eventCount: number;
  topEvents: Array<{ type: string; count: number }>;
}

export interface SnapshotDto {
  id: string;
  tick: number;
  stateHash: string;
  createdAt: string;
  summary: {
    civilizations: number;
    cities: number;
    species: number;
    plants: number;
    population: number;
    tempShift: number;
    pollution: number;
  };
}

export interface SnapshotCompare {
  fromTick: number;
  toTick: number;
  deltas: Record<string, number>;
  notableEvents: number;
}
