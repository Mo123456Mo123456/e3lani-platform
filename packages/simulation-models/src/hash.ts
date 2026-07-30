import type { WorldState } from "./world-state.js";

/** Stable hash of authoritative world fields for snapshot equality tests */
export function hashWorld(state: WorldState): string {
  const payload = {
    seed: state.seed,
    tick: state.tick,
    year: state.year,
    rngState: state.rngState,
    civs: state.civilizations.map((c) => [c.id, c.population, round(c.stability), round(c.economy)]),
    wars: state.wars.map((w) => w.id).sort(),
    speciesPop: state.species.reduce((s, x) => s + x.population, 0),
    plantCov: round(state.plants.reduce((s, p) => s + p.coverage, 0)),
    pollution: round(
      state.regions.reduce((s, r) => s + r.pollution, 0) / state.regions.length,
    ),
    eventCount: state.events.length,
    lastEvent: state.events[state.events.length - 1]?.id ?? null,
  };
  return fnv1a(JSON.stringify(payload));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
