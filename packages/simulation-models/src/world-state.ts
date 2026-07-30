import type {
  BiomeType,
  ContributionCategory,
  TickUnit,
  WorldEventType,
} from "@planet/shared-types";

export interface SimRegion {
  id: string;
  index: number;
  name: string;
  nameAr: string;
  lat: number;
  lon: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  pollution: number;
  biome: BiomeType;
  population: number;
  water: number;
  neighbors: number[];
}

export interface SimSpecies {
  id: string;
  name: string;
  nameAr: string;
  regionIds: string[];
  population: number;
  size: number;
  reproduction: number;
  aggression: number;
  intelligence: number;
  coldResistance: number;
  heatResistance: number;
  waterNeed: number;
  foodNeed: number;
  adaptability: number;
  mutationRate: number;
  trophicLevel: number;
  contributionId?: string;
}

export interface SimPlant {
  id: string;
  name: string;
  nameAr: string;
  regionIds: string[];
  coverage: number;
  growthRate: number;
  waterNeed: number;
  pollutionAbsorption: number;
  energyOutput: number;
  nightLuminosity: number;
  fertilityBoost: number;
  contributionId?: string;
}

export interface SimResource {
  id: string;
  name: string;
  nameAr: string;
  regionId: string;
  amount: number;
  renewRate: number;
  extractRate: number;
  value: number;
  environmentalImpact: number;
  contributionId?: string;
}

export interface SimCity {
  id: string;
  name: string;
  nameAr: string;
  regionId: string;
  population: number;
  civilizationId: string;
}

export interface SimCivilization {
  id: string;
  name: string;
  nameAr: string;
  regionIds: string[];
  capitalCityId: string;
  population: number;
  techLevel: number;
  military: number;
  economy: number;
  food: number;
  health: number;
  stability: number;
  happiness: number;
  education: number;
  pollution: number;
  aggression: number;
  innovation: number;
  culture: string;
  language: string;
  government: string;
  allies: string[];
  enemies: string[];
  memory: SimMemoryEntry[];
  contributionId?: string;
}

export interface SimMemoryEntry {
  tick: number;
  kind: string;
  targetId?: string;
  intensity: number;
  note: string;
}

export interface SimTechnology {
  id: string;
  name: string;
  nameAr: string;
  level: number;
  category: string;
  discovererCivId?: string;
  contributionId?: string;
}

export interface SimWar {
  id: string;
  attackerId: string;
  defenderId: string;
  regionId: string;
  strength: number;
  startedTick: number;
  cause: string;
}

export interface SimMigration {
  id: string;
  fromRegionId: string;
  toRegionId: string;
  population: number;
  speciesId?: string;
  civilizationId?: string;
  startedTick: number;
  reason: string;
}

export interface SimTradeRoute {
  id: string;
  fromCityId: string;
  toCityId: string;
  resourceId: string;
  volume: number;
  risk: number;
}

export interface SimDisease {
  id: string;
  name: string;
  nameAr: string;
  contagiousness: number;
  lethality: number;
  regionIds: string[];
  infected: number;
  contributionId?: string;
}

export interface SimContribution {
  id: string;
  userId: string;
  category: ContributionCategory;
  name: string;
  nameAr: string;
  regionId: string;
  traits: Record<string, number>;
  appliedTick: number;
  entityId: string;
}

export interface SimEvent {
  id: string;
  type: WorldEventType;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  tick: number;
  year: number;
  regionId?: string;
  importance: number;
  confidence: number;
  causes: string[];
  effects: string[];
  contributionId?: string;
  actorIds: string[];
  payload: Record<string, unknown>;
}

export interface CausalEdge {
  id: string;
  fromEventId: string;
  toEventId: string;
  relation: string;
  strength: number;
  description: string;
  descriptionAr: string;
}

export interface WorldState {
  planetId: string;
  seed: number;
  name: string;
  nameAr: string;
  tick: number;
  tickUnit: TickUnit;
  year: number;
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
  diseases: SimDisease[];
  contributions: SimContribution[];
  events: SimEvent[];
  causalLinks: CausalEdge[];
  rngState: number;
}

export interface WorldSnapshot {
  tick: number;
  year: number;
  state: WorldState;
  hash: string;
}

export function cloneWorld(state: WorldState): WorldState {
  return structuredClone(state);
}

export function worldMetrics(state: WorldState) {
  const land = state.regions.filter((r) => r.biome !== "ocean");
  const pollution =
    land.reduce((s, r) => s + r.pollution, 0) / Math.max(1, land.length);
  const stability =
    state.civilizations.reduce((s, c) => s + c.stability, 0) /
    Math.max(1, state.civilizations.length);
  const temperature =
    land.reduce((s, r) => s + r.temperature, 0) / Math.max(1, land.length);
  return {
    civilizationCount: state.civilizations.length,
    cityCount: state.cities.length,
    speciesCount: state.species.length,
    plantCount: state.plants.length,
    resourceCount: state.resources.length,
    technologyCount: state.technologies.length,
    activeWars: state.wars.length,
    activeMigrations: state.migrations.length,
    globalPollution: round4(pollution),
    globalStability: round4(stability || 0.5),
    globalTemperature: round4(temperature),
    population: state.civilizations.reduce((s, c) => s + c.population, 0),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
