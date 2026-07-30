import type { Biome, ContributionCategory } from "@planet/config";
import type {
  CausalGraph,
  SimulationEffect,
  StructuredContribution,
  WorldEventDto,
} from "@planet/shared-types";

export interface SimRegion {
  id: string;
  name: string;
  nameEn: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  pollution: number;
  population: number;
  carryingCapacity: number;
  biome: Biome;
  civilizationId?: string;
  resourceIds: string[];
  speciesIds: string[];
  plantIds: string[];
}

export interface SimSpecies {
  id: string;
  name: string;
  nameEn: string;
  population: number;
  size: number;
  reproduction: number;
  aggression: number;
  intelligence: number;
  heatResistance: number;
  coldResistance: number;
  waterNeed: number;
  adaptability: number;
  preferredBiomes: Biome[];
  preyOf: string[];
  foodOf: string[];
  contributionId?: string;
}

export interface SimPlant {
  id: string;
  name: string;
  nameEn: string;
  coverage: number;
  growthRate: number;
  waterNeed: number;
  pollutionAbsorption: number;
  luminosity: number;
  preferredBiomes: Biome[];
  contributionId?: string;
}

export interface SimResource {
  id: string;
  name: string;
  nameEn: string;
  regionId: string;
  quantity: number;
  renewal: number;
  value: number;
  extraction: number;
  environmentalImpact: number;
}

export interface SimCivilization {
  id: string;
  name: string;
  nameEn: string;
  population: number;
  techLevel: number;
  military: number;
  economy: number;
  food: number;
  stability: number;
  aggression: number;
  innovation: number;
  happiness: number;
  pollution: number;
  education: number;
  capitalRegionId: string;
  cityIds: string[];
  allyIds: string[];
  enemyIds: string[];
  memory: Array<{ tick: number; kind: string; targetId?: string; note: string }>;
  contributionId?: string;
}

export interface SimCity {
  id: string;
  name: string;
  nameEn: string;
  civilizationId: string;
  regionId: string;
  population: number;
}

export interface SimTechnology {
  id: string;
  name: string;
  nameEn: string;
  level: number;
  civilizationIds: string[];
  contributionId?: string;
}

export interface SimWar {
  id: string;
  aId: string;
  bId: string;
  regionId: string;
  strength: number;
  startedTick: number;
  active: boolean;
}

export interface SimMigration {
  id: string;
  fromRegionId: string;
  toRegionId: string;
  population: number;
  startedTick: number;
  active: boolean;
  reason: string;
}

export interface SimTradeRoute {
  id: string;
  fromCityId: string;
  toCityId: string;
  risk: number;
  value: number;
}

export interface SimAlliance {
  id: string;
  aId: string;
  bId: string;
  formedTick: number;
}

export interface SimDisease {
  id: string;
  name: string;
  infectivity: number;
  severity: number;
  regionIds: string[];
}

export interface WorldState {
  planetId: string;
  seed: number;
  tick: number;
  year: number;
  tickUnit: "day" | "month" | "year" | "decade";
  regions: SimRegion[];
  species: SimSpecies[];
  plants: SimPlant[];
  resources: SimResource[];
  civilizations: SimCivilization[];
  cities: SimCity[];
  technologies: SimTechnology[];
  wars: SimWar[];
  migrations: SimMigration[];
  tradeRoutes: SimTradeRoute[];
  alliances: SimAlliance[];
  diseases: SimDisease[];
  eventLog: WorldEventDto[];
  contributions: Array<{
    id: string;
    userId: string;
    category: ContributionCategory;
    structured: StructuredContribution;
    regionId: string;
    appliedTick: number;
  }>;
}

export interface TickResult {
  state: WorldState;
  events: WorldEventDto[];
  effects: SimulationEffect[];
  causalGraph: CausalGraph;
}
