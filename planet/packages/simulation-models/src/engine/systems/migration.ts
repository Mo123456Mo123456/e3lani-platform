import { BiomeType, WorldEventType } from "@planet/shared-types";
import { chance } from "../../rng.js";
import { habitability } from "../../planet/biomes.js";
import { BIOME_ORDER } from "../../planet/types.js";
import { emitEvent } from "../events.js";
import { findPath } from "../pathfind.js";
import { nextId, type WorldState } from "../types.js";

/**
 * Migration: population flows under pressure (famine, war, climate) toward
 * habitable, reachable land. Paths come from A* — migrations never cross
 * impossible terrain.
 */
export function applyMigrations(world: WorldState): void {
  // Start new migrations from stressed civilizations.
  for (const civ of world.civs) {
    if (civ.fallen || civ.cells.length === 0) continue;
    const stressed = civ.foodSecurity < 0.25 || civ.stability < 0.3;
    if (!stressed || !chance(world.rng, "migration", 0.15)) continue;
    const from = civ.cells[0] as number;
    // Seek a better cell: sample candidates on land outside the territory.
    let best: number | null = null;
    let bestScore = civ.foodSecurity;
    for (let t = 0; t < 12; t++) {
      const candidate = Math.floor((world.rng.counters["migration"] = (world.rng.counters["migration"] ?? 0) + 1, Math.abs(hashish(world.seed, world.rng.counters["migration"]!)) % world.grid.cellCount));
      if ((world.grid.elevation[candidate] ?? 0) <= world.grid.seaLevel) continue;
      if (world.civs.some((o) => !o.fallen && o.cells.includes(candidate))) continue;
      const b = BIOME_ORDER[world.grid.biome[candidate] ?? 0] ?? BiomeType.Ocean;
      const score = habitability(b) * (world.grid.fertility[candidate] ?? 0);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (best === null) continue;
    const path = findPath(world.grid, from, best);
    if (!path || path.length < 2) continue;
    const people = civ.population * 0.08;
    civ.population -= people;
    world.migrations.push({
      id: nextId(world, "migration"),
      civId: civ.id,
      fromCell: from,
      toCell: best,
      path,
      people,
      startedTick: world.tick,
      done: false,
      reason: civ.foodSecurity < 0.25 ? "famine" : "instability",
    });
    emitEvent(world, {
      type: WorldEventType.MigrationStarted,
      cellIndex: from,
      civIds: [civ.id],
      payload: { from, to: best, people: Math.round(people), reason: civ.foodSecurity < 0.25 ? "famine" : "instability" },
      importance: 0.5,
    });
  }

  // Progress ongoing migrations along their paths.
  for (const m of world.migrations) {
    if (m.done) continue;
    if (m.path.length === 0) {
      m.done = true;
      continue;
    }
    // Arrival after travelling the full path (1 segment per tick).
    const elapsed = world.tick - m.startedTick;
    if (elapsed >= m.path.length) {
      m.done = true;
      const civ = world.civs.find((c) => c.id === m.civId);
      if (civ && !civ.fallen) {
        civ.population += m.people;
        if (!civ.cells.includes(m.toCell)) {
          civ.cells.push(m.toCell);
          civ.cells.sort((a, b) => a - b);
        }
      }
    }
  }
  // Keep the list bounded.
  if (world.migrations.length > 200) {
    world.migrations = world.migrations.filter((m) => !m.done).slice(-100);
  }
}

function hashish(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n, 0x9e3779b9)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  return h >>> 0;
}
