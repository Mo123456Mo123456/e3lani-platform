import type { WorldState } from "./types.js";
import type { PlanetGrid } from "../planet/types.js";
import { stableStringify, fnv1a } from "../hash.js";

/** Deep in-memory snapshot (typed arrays preserved). */
export function takeSnapshot(world: WorldState): WorldState {
  return structuredClone(world);
}

export function restoreSnapshot(snapshot: WorldState): WorldState {
  return structuredClone(snapshot);
}

interface JsonWorld extends Omit<WorldState, "grid"> {
  grid: Omit<PlanetGrid, "elevation" | "temperature" | "moisture" | "biome" | "fertility" | "pollution" | "river" | "ice" | "volcanic" | "windDir"> & {
    elevation: number[];
    temperature: number[];
    moisture: number[];
    biome: number[];
    fertility: number[];
    pollution: number[];
    river: number[];
    ice: number[];
    volcanic: number[];
    windDir: number[];
  };
}

/** JSON-safe serialization (typed arrays -> plain arrays). */
export function serializeWorld(world: WorldState): string {
  const g = world.grid;
  const json: JsonWorld = {
    ...world,
    grid: {
      width: g.width, height: g.height, cellCount: g.cellCount, seaLevel: g.seaLevel,
      elevation: Array.from(g.elevation),
      temperature: Array.from(g.temperature),
      moisture: Array.from(g.moisture),
      biome: Array.from(g.biome),
      fertility: Array.from(g.fertility),
      pollution: Array.from(g.pollution),
      river: Array.from(g.river),
      ice: Array.from(g.ice),
      volcanic: Array.from(g.volcanic),
      windDir: Array.from(g.windDir),
    },
  };
  return JSON.stringify(json);
}

export function deserializeWorld(data: string): WorldState {
  const json = JSON.parse(data) as JsonWorld;
  const g = json.grid;
  return {
    ...json,
    grid: {
      width: g.width, height: g.height, cellCount: g.cellCount, seaLevel: g.seaLevel,
      elevation: Float32Array.from(g.elevation),
      temperature: Float32Array.from(g.temperature),
      moisture: Float32Array.from(g.moisture),
      biome: Uint8Array.from(g.biome),
      fertility: Float32Array.from(g.fertility),
      pollution: Float32Array.from(g.pollution),
      river: Uint8Array.from(g.river),
      ice: Float32Array.from(g.ice),
      volcanic: Float32Array.from(g.volcanic),
      windDir: Float32Array.from(g.windDir),
    },
  };
}

/** Checksum of the deterministic core (excludes the event log tails). */
export function worldChecksum(world: WorldState): string {
  const core = {
    seed: world.seed,
    tick: world.tick,
    rngCounters: world.rng.counters,
    species: world.species.map((s) => [s.id, s.extinct, Math.round(totalPop(s) * 1000)]),
    civs: world.civs.map((c) => [c.id, c.fallen, Math.round(c.population), c.techLevel]),
    cities: world.cities.map((c) => [c.id, c.fallen, Math.round(c.population)]),
    eventCount: world.events.length,
    lastEventHash: world.events.length > 0 ? world.events[world.events.length - 1]?.hash : "genesis",
  };
  return fnv1a(stableStringify(core)).toString(16);
}

function totalPop(s: { cells: Record<string, number> }): number {
  let t = 0;
  for (const k of Object.keys(s.cells)) t += s.cells[k] ?? 0;
  return t;
}
