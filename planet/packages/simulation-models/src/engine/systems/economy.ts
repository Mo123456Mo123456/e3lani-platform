import { WorldEventType } from "@planet/shared-types";
import { clamp01 } from "../../math.js";
import { chance } from "../../rng.js";
import { emitEvent } from "../events.js";
import type { WorldState } from "../types.js";

/**
 * Economy: deposits are discovered by the civ controlling their cell,
 * extracted at their rate, and depleted; active trade routes compound
 * economic growth and warm relations.
 */
export function applyEconomy(world: WorldState): void {
  for (const deposit of world.deposits) {
    if (deposit.depleted) continue;
    const owner = world.civs.find((c) => !c.fallen && c.cells.includes(deposit.cell));
    if (!owner) continue;

    if (deposit.discoveredBy === undefined) {
      deposit.discoveredBy = owner.id;
      owner.economy = clamp01(owner.economy + 0.02 * deposit.value);
      emitEvent(world, {
        type: WorldEventType.ResourceDiscovered,
        cellIndex: deposit.cell,
        civIds: [owner.id],
        payload: { kind: deposit.kind, value: deposit.value, civ: owner.name },
        importance: 0.35 + deposit.value * 0.1,
      });
    }

    const extracted = deposit.quantity * deposit.extractionRate * (0.5 + owner.techLevel * 0.02);
    deposit.quantity -= extracted;
    if (deposit.regenRate > 0) {
      deposit.quantity = Math.min(deposit.quantity + deposit.quantity * deposit.regenRate, 2000);
    }
    owner.stockpiles[deposit.kind] = (owner.stockpiles[deposit.kind] ?? 0) + extracted * 0.01;
    owner.economy = clamp01(owner.economy + extracted * 0.00002 * deposit.value);

    if (deposit.quantity <= 1) {
      deposit.depleted = true;
      owner.economy = Math.max(0, owner.economy - 0.04);
      emitEvent(world, {
        type: WorldEventType.ResourceDepleted,
        cellIndex: deposit.cell,
        civIds: [owner.id],
        payload: { kind: deposit.kind, civ: owner.name },
        importance: 0.5,
      });
      // Scarcity raises tension with neighbours holding the same resource.
      for (const other of world.deposits) {
        if (other.kind !== deposit.kind || other.depleted) continue;
        const holder = world.civs.find((c) => !c.fallen && c.id !== owner.id && c.cells.includes(other.cell));
        if (holder) {
          const key = owner.id < holder.id ? `${owner.id}:${holder.id}` : `${holder.id}:${owner.id}`;
          world.relations[key] = (world.relations[key] ?? 0) - 0.05;
        }
      }
    }
  }

  // Trade routes compound.
  for (const route of world.tradeRoutes) {
    if (!route.active) continue;
    const from = world.cities.find((c) => c.id === route.fromCity && !c.fallen);
    const to = world.cities.find((c) => c.id === route.toCity && !c.fallen);
    if (!from || !to || from.civId === to.civId) {
      route.active = false;
      continue;
    }
    const a = world.civs.find((c) => c.id === from.civId);
    const b = world.civs.find((c) => c.id === to.civId);
    if (!a || !b) continue;
    const gain = route.volume * 0.001;
    a.economy = clamp01(a.economy + gain);
    b.economy = clamp01(b.economy + gain);
    route.volume = Math.min(route.volume * 1.001, 1);
    const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
    world.relations[key] = clamp01((world.relations[key] ?? 0) + 0.0005) * 0.999 + 0.0004;
    if (chance(world.rng, "economy", 0.001)) {
      route.active = false; // routes occasionally collapse (war, piracy…)
    }
  }
}
