import { WorldEventType, type WorldEvent } from "@planet/shared-types";
import { emitEvent } from "./events.js";
import type { WorldState } from "./types.js";
import { applyClimate } from "./systems/climate.js";
import { applyEcology } from "./systems/ecology.js";
import { applyCivilizations } from "./systems/civilization.js";
import { applyEconomy } from "./systems/economy.js";
import { applyConflicts } from "./systems/conflict.js";
import { applyMigrations } from "./systems/migration.js";
import { applyDiseases } from "./systems/disease.js";

const ERAS: { minYear: number; name: string }[] = [
  { minYear: 0, name: "genesis" },
  { minYear: 500, name: "dawn_of_civilization" },
  { minYear: 2000, name: "age_of_empires" },
  { minYear: 4000, name: "industrial_age" },
  { minYear: 6000, name: "technological_age" },
  { minYear: 9000, name: "planetary_age" },
];

/**
 * Advance the world by one tick. System order is fixed — climate, ecology,
 * civilizations, economy, conflicts, migrations, diseases — so the same
 * seed always produces the same history.
 */
export function runTick(world: WorldState): WorldEvent[] {
  world.tick += 1;
  const before = world.events.length;

  applyClimate(world);
  applyEcology(world);
  applyCivilizations(world);
  applyEconomy(world);
  applyConflicts(world);
  applyMigrations(world);
  applyDiseases(world);

  const year = world.tick * world.yearsPerTick;
  const era = [...ERAS].reverse().find((e) => year >= e.minYear);
  if (era && era.name !== world.era) {
    world.era = era.name;
    emitEvent(world, {
      type: WorldEventType.EraStarted,
      payload: { era: era.name, year },
      importance: 0.9,
    });
  }

  return world.events.slice(before);
}

/** Run N ticks, returning all events produced. */
export function runTicks(world: WorldState, count: number): WorldEvent[] {
  const out: WorldEvent[] = [];
  for (let i = 0; i < count; i++) {
    out.push(...runTick(world));
  }
  return out;
}
