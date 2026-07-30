/**
 * World state container + (de)serialization helpers.
 * The state is plain JSON data: snapshots are structured clones and the
 * fingerprint is a stable hash — both essential for deterministic replay.
 */
import type {
  Alliance,
  City,
  Civilization,
  Contribution,
  Culture,
  Disease,
  Language,
  Migration,
  Plant,
  Species,
  Technology,
  TradeRoute,
  War,
} from "@planet/shared-types";
import { fingerprint } from "../rng.js";
import type { PlanetGrid } from "../worldgen/planet.js";

export interface ClimateState {
  /** 0..1 global mean temperature anomaly driver */
  globalTemp: number;
  /** cooling from recent eruptions, decays each tick */
  volcanicForcing: number;
  /** cell index -> consecutive dry ticks */
  droughtStreak: Record<number, number>;
  /** civId -> pending war target civId (decision hand-off between systems) */
  warIntents: Record<string, string>;
}

export interface WorldState {
  planetId: string;
  seed: string;
  tick: number;
  year: number;
  yearsPerTick: number;
  grid: PlanetGrid;
  species: Species[];
  plants: Plant[];
  civs: Civilization[];
  cities: City[];
  techs: Technology[];
  cultures: Culture[];
  languages: Language[];
  tradeRoutes: TradeRoute[];
  alliances: Alliance[];
  wars: War[];
  diseases: Disease[];
  migrations: Migration[];
  contributions: Contribution[];
  climate: ClimateState;
  counters: { entity: number; event: number };
}

export function cloneState(state: WorldState): WorldState {
  return structuredClone(state);
}

export function stateFingerprint(state: WorldState): string {
  return fingerprint({
    tick: state.tick,
    year: state.year,
    cells: state.grid.cells.map((c) => [
      c.biome,
      Math.round(c.temperature * 1000),
      Math.round(c.moisture * 1000),
      Math.round(c.pollution * 1000),
      c.ownerId,
      c.river,
      c.resources.map((r) => [r.type, Math.round(r.quantity), r.discovered]),
    ]),
    species: state.species.map((s) => [
      s.id,
      Math.round(s.population),
      s.habitat,
      s.extinctAtTick,
    ]),
    plants: state.plants.map((p) => [p.id, p.coverage]),
    civs: state.civs.map((c) => [
      c.id,
      Math.round(c.population),
      c.techLevel,
      Math.round(c.stability * 1000),
      c.collapsedAtTick,
      c.relations,
    ]),
    cities: state.cities.map((c) => [c.id, c.cell, Math.round(c.population), c.destroyedAtTick]),
    routes: state.tradeRoutes.map((r) => [r.id, r.active]),
    wars: state.wars.map((w) => [w.id, w.endedAtTick, w.casualties]),
    alliances: state.alliances.map((a) => [a.id, a.dissolvedAtTick]),
    diseases: state.diseases.map((d) => [d.id, d.endedAtTick]),
    counters: state.counters,
    climate: [Math.round(state.climate.globalTemp * 10000), Math.round(state.climate.volcanicForcing * 10000)],
  });
}

/** civId -> owned cell indexes, rebuilt per tick. */
export function buildOwnershipIndex(state: WorldState): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const cell of state.grid.cells) {
    if (!cell.ownerId) continue;
    const list = map.get(cell.ownerId);
    if (list) list.push(cell.index);
    else map.set(cell.ownerId, [cell.index]);
  }
  return map;
}

/** cell index -> plants with coverage there (cached per tick by callers). */
export function buildPlantIndex(state: WorldState): Map<number, Plant[]> {
  const map = new Map<number, Plant[]>();
  for (const plant of state.plants) {
    for (const cellStr of Object.keys(plant.coverage)) {
      const cell = Number(cellStr);
      const list = map.get(cell);
      if (list) list.push(plant);
      else map.set(cell, [plant]);
    }
  }
  return map;
}

export function nextEntityId(state: WorldState, prefix: string): string {
  state.counters.entity++;
  return `${prefix}-${state.counters.entity}`;
}
