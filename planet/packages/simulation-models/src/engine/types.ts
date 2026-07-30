import type {
  AnalyzedTraits,
  GovernmentType,
  ResourceKind,
} from "@planet/shared-types";
import type { RngState } from "../rng.js";
import type { PlanetGrid, ResourceDeposit } from "../planet/types.js";
import type { WorldEvent } from "@planet/shared-types";

export type Diet = "herbivore" | "carnivore" | "omnivore" | "photosynthesis";

export interface Species {
  id: number;
  name: string;
  kind: "flora" | "fauna";
  diet: Diet;
  size: number;
  speed: number;
  lifespan: number;
  reproductionRate: number;
  intelligence: number;
  aggression: number;
  adaptability: number;
  mutationRate: number;
  coldResistance: number;
  heatResistance: number;
  waterNeed: number;
  pollutionAbsorption: number;
  nightLuminosity: number;
  toxicity: number;
  /** cell index (as string) -> population units present in that cell. */
  cells: Record<string, number>;
  prey: number[];
  predators: number[];
  parentSpecies?: number;
  extinct: boolean;
  bornTick: number;
  contributionId?: string;
}

export interface Technology {
  id: number;
  name: string;
  tier: number;
  discoveredBy?: number;
  discoveredTick?: number;
  contributionId?: string;
}

export interface City {
  id: number;
  name: string;
  civId: number;
  cell: number;
  population: number;
  health: number;
  foundedTick: number;
  fallen: boolean;
}

export interface CivMemory {
  /** Grievances remember past attacks; they decay but never vanish at once. */
  grievances: { civId: number; weight: number; tick: number }[];
  pastAllies: number[];
  notableEvents: number[];
}

export interface Civilization {
  id: number;
  name: string;
  population: number;
  /** Sorted territory array (deterministic iteration). */
  cells: number[];
  capitalCell: number;
  techLevel: number;
  government: GovernmentType;
  military: number;
  economy: number;
  stability: number;
  happiness: number;
  education: number;
  health: number;
  pollutionOutput: number;
  foodSecurity: number;
  aggression: number;
  expansionism: number;
  curiosity: number;
  culture: string;
  language: string;
  religion: string;
  stockpiles: Record<string, number>;
  fallen: boolean;
  foundedTick: number;
  memory: CivMemory;
  contributionId?: string;
}

export interface War {
  id: number;
  attacker: number;
  defender: number;
  startedTick: number;
  endedTick?: number;
  casualties: number;
  reason: string;
  causeEvents: number[];
  contributionId?: string;
}

export interface Alliance {
  id: number;
  civIds: number[];
  createdTick: number;
  brokenTick?: number;
  causeEvents: number[];
}

export interface Disease {
  id: number;
  name: string;
  virulence: number;
  lethality: number;
  /** cells currently affected. */
  cells: number[];
  startedTick: number;
  active: boolean;
  contributionId?: string;
}

export interface Migration {
  id: number;
  civId?: number;
  speciesId?: number;
  fromCell: number;
  toCell: number;
  path: number[];
  people: number;
  startedTick: number;
  done: boolean;
  reason: string;
}

export interface TradeRoute {
  id: number;
  fromCity: number;
  toCity: number;
  path: number[];
  volume: number;
  active: boolean;
  createdTick: number;
}

/** A global modifier introduced by a "world law" contribution. */
export interface WorldLaw {
  id: number;
  name: string;
  /** e.g. "plantGrowthMultiplier", "pollutionCap", "warReluctance" */
  modifier: string;
  factor: number;
  createdTick: number;
  contributionId?: string;
}

export interface WorldState {
  id: string;
  name: string;
  seed: number;
  tick: number;
  yearsPerTick: number;
  rng: RngState;
  grid: PlanetGrid;
  species: Species[];
  civs: Civilization[];
  cities: City[];
  deposits: ResourceDeposit[];
  techs: Technology[];
  wars: War[];
  alliances: Alliance[];
  diseases: Disease[];
  migrations: Migration[];
  tradeRoutes: TradeRoute[];
  laws: WorldLaw[];
  /** "a:b" (a<b) -> tension -1..1 (positive = friendly). */
  relations: Record<string, number>;
  events: WorldEvent[];
  nextIds: Record<string, number>;
  /** contributionId -> event seqs it ultimately caused (root list). */
  contributionRoots: Record<string, number>;
  era: string;
}

export function relationKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function getRelation(world: WorldState, a: number, b: number): number {
  return world.relations[relationKey(a, b)] ?? 0;
}

export function setRelation(world: WorldState, a: number, b: number, v: number): void {
  world.relations[relationKey(a, b)] = Math.max(-1, Math.min(1, v));
}

export function nextId(world: WorldState, counter: string): number {
  const n = world.nextIds[counter] ?? 1;
  world.nextIds[counter] = n + 1;
  return n;
}

export function speciesPopulation(s: Species): number {
  let total = 0;
  for (const k of Object.keys(s.cells)) total += s.cells[k] ?? 0;
  return total;
}

export function traitsDefault(): AnalyzedTraits {
  return {
    size: 0.5, growthRate: 0.5, waterNeed: 0.5, energyOutput: 0,
    pollutionAbsorption: 0, pollutionEmission: 0, coldResistance: 0.5,
    heatResistance: 0.5, aggression: 0.3, intelligence: 0.3,
    reproductionRate: 0.5, lifespan: 0.5, adaptability: 0.5, rarity: 0.5,
    nightLuminosity: 0, toxicity: 0, spreadRate: 0.5,
  };
}
