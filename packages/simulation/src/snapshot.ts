import { fnv1a } from "./rng.js";
import type { WorldState } from "./types.js";

/**
 * World state is a graph of Maps/Sets; these helpers convert it to plain JSON
 * and back so snapshots, rollbacks and scenario forks are trivial.
 */
export type SerializedWorld = Record<string, unknown>;

export function serializeWorld(state: WorldState): SerializedWorld {
  // JSON round-trip guarantees snapshots are fully detached from live state
  return JSON.parse(JSON.stringify({
    seed: state.seed,
    tick: state.tick,
    simYear: state.simYear,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    cells: state.cells.map((c) => ({ ...c, resources: c.resources.map((r) => ({ ...r })) })),
    species: [...state.species.entries()].map(([k, v]) => [k, { ...v, preyIds: [...v.preyIds] }]),
    speciesPops: [...state.speciesPops.entries()].map(([k, v]) => [k, [...v.entries()]]),
    plants: [...state.plants.entries()].map(([k, v]) => [k, { ...v, cells: [...v.cells] }]),
    civs: [...state.civs.entries()].map(([k, v]) => [
      k,
      {
        ...v,
        territory: [...v.territory],
        techKeys: [...v.techKeys],
        stockpiles: { ...v.stockpiles },
        relations: { ...v.relations },
        memory: [...v.memory],
        actionCooldowns: { ...v.actionCooldowns },
      },
    ]),
    cities: [...state.cities.entries()].map(([k, v]) => [k, { ...v }]),
    techTree: state.techTree.map((t) => ({ ...t, prereqKeys: [...t.prereqKeys], effects: { ...t.effects } })),
    tradeRoutes: [...state.tradeRoutes.entries()].map(([k, v]) => [k, { ...v, path: [...v.path], goods: [...v.goods] }]),
    alliances: [...state.alliances.entries()].map(([k, v]) => [k, { ...v, memberCivIds: [...v.memberCivIds] }]),
    wars: [...state.wars.entries()].map(([k, v]) => [k, { ...v, frontCells: [...v.frontCells] }]),
    diseases: [...state.diseases.entries()].map(([k, v]) => [k, { ...v, affectedCivIds: [...v.affectedCivIds], cells: [...v.cells] }]),
    migrations: [...state.migrations.entries()].map(([k, v]) => [k, { ...v, path: [...v.path] }]),
    laws: { ...state.laws },
    phenomena: state.phenomena.map((p) => ({ ...p })),
    globalTempAnomaly: state.globalTempAnomaly,
    volcanicAerosol: state.volcanicAerosol,
    pendingContributions: state.pendingContributions,
  })) as SerializedWorld;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function deserializeWorld(data: SerializedWorld): WorldState {
  const d = data as any;
  return {
    seed: d.seed,
    tick: d.tick,
    simYear: d.simYear,
    gridWidth: d.gridWidth,
    gridHeight: d.gridHeight,
    cells: d.cells,
    species: new Map(d.species),
    speciesPops: new Map((d.speciesPops as any[]).map(([k, v]) => [k, new Map(v)])),
    plants: new Map((d.plants as any[]).map(([k, v]) => [k, { ...v, cells: new Set(v.cells) }])),
    civs: new Map((d.civs as any[]).map(([k, v]) => [k, { ...v, territory: new Set(v.territory), techKeys: new Set(v.techKeys) }])),
    cities: new Map(d.cities),
    techTree: d.techTree,
    tradeRoutes: new Map(d.tradeRoutes),
    alliances: new Map(d.alliances),
    wars: new Map((d.wars as any[]).map(([k, v]) => [k, { ...v, frontCells: new Set(v.frontCells) }])),
    diseases: new Map((d.diseases as any[]).map(([k, v]) => [k, { ...v, affectedCivIds: new Set(v.affectedCivIds), cells: new Set(v.cells) }])),
    migrations: new Map(d.migrations),
    laws: d.laws,
    phenomena: d.phenomena,
    globalTempAnomaly: d.globalTempAnomaly,
    volcanicAerosol: d.volcanicAerosol,
    pendingContributions: d.pendingContributions,
  };
}

/** JSON with deterministic key ordering — basis of state hashing */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

export function hashWorld(state: WorldState): string {
  const serialized = serializeWorld(state);
  // transient storm fields add noise to the hash without changing identity;
  // keep them — determinism tests compare engines on the same machine.
  return fnv1a(stableStringify(serialized)).toString(16);
}
