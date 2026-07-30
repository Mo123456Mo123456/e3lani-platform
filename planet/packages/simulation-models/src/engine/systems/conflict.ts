import { WorldEventType } from "@planet/shared-types";
import { clamp01 } from "../../math.js";
import { chance, random } from "../../rng.js";
import { emitEvent } from "../events.js";
import { getRelation, setRelation, type WorldState } from "../types.js";

/**
 * War resolution. Battle power combines troops, technology, terrain,
 * supplies, morale, weather and alliance support. Wars produce casualties,
 * territory change, refugees and eventually treaties — never random noise.
 */
export function applyConflicts(world: WorldState): void {
  for (const war of world.wars) {
    if (war.endedTick !== undefined) continue;
    const attacker = world.civs.find((c) => c.id === war.attacker);
    const defender = world.civs.find((c) => c.id === war.defender);
    if (!attacker || !defender || attacker.fallen || defender.fallen) {
      war.endedTick = world.tick;
      continue;
    }

    const attackerAllies = world.alliances.filter(
      (a) => !a.brokenTick && a.civIds.includes(attacker.id),
    ).length;
    const defenderAllies = world.alliances.filter(
      (a) => !a.brokenTick && a.civIds.includes(defender.id),
    ).length;

    const contestedCell = defender.cells[Math.floor(random(world.rng, "war") * defender.cells.length)] ?? defender.capitalCell;
    const weatherPenalty = clamp01(Math.abs(world.grid.temperature[contestedCell] ?? 0)) * 0.2;
    const terrainDefense = (world.grid.elevation[contestedCell] ?? 0) > world.grid.seaLevel + 0.2 ? 0.25 : 0;

    const attackPower =
      attacker.military * (1 + attacker.techLevel * 0.12) * attacker.stability *
      (1 + attackerAllies * 0.15) * (attacker.foodSecurity * 0.5 + 0.5) * (1 - weatherPenalty);
    const defensePower =
      defender.military * (1 + defender.techLevel * 0.12) * (1 + terrainDefense) *
      (1 + defenderAllies * 0.15) * defender.stability;

    const ratio = attackPower / Math.max(defensePower, 0.01);
    const attackerWins = chance(world.rng, "war", ratio / (1 + ratio));

    const casualties = (attacker.population + defender.population) * 0.002 * (attackerWins ? 1 / Math.max(ratio, 0.5) : ratio);
    war.casualties += casualties;
    attacker.population = Math.max(0, attacker.population - casualties * 0.4);
    defender.population = Math.max(0, defender.population - casualties * 0.6);
    attacker.stability = Math.max(0, attacker.stability - 0.005);
    defender.stability = Math.max(0, defender.stability - 0.008);

    if (attackerWins && defender.cells.length > 1) {
      // Territory transfer: border cell changes hands.
      const cell = contestedCell;
      defender.cells = defender.cells.filter((c) => c !== cell);
      if (!attacker.cells.includes(cell)) {
        attacker.cells.push(cell);
        attacker.cells.sort((a, b) => a - b);
      }
      const city = world.cities.find((c) => c.cell === cell && !c.fallen);
      if (city) {
        city.civId = attacker.id;
        emitEvent(world, {
          type: WorldEventType.CityFallen,
          cellIndex: cell,
          civIds: [attacker.id, defender.id],
          payload: { city: city.name, newOwner: attacker.name },
          causes: war.causeEvents,
          importance: 0.7,
        });
      }
      // Refugees flee the captured cell.
      world.migrations.push({
        id: world.nextIds["migration"] ?? 1,
        civId: defender.id,
        fromCell: cell,
        toCell: defender.cells[0] ?? cell,
        path: [],
        people: casualties * 2,
        startedTick: world.tick,
        done: false,
        reason: "war_refugees",
      });
      world.nextIds["migration"] = (world.nextIds["migration"] ?? 1) + 1;
    }

    // War exhaustion ends wars.
    const exhaustion = war.casualties / Math.max(attacker.population + defender.population, 1);
    const defenderBroken = defender.cells.length === 0 || defender.military < 0.05;
    if (exhaustion > 0.08 || defenderBroken || chance(world.rng, "war", 0.02)) {
      war.endedTick = world.tick;
      const victor = defenderBroken ? attacker : ratio > 1 ? attacker : defender;
      const loser = victor.id === attacker.id ? defender : attacker;
      victor.economy = clamp01(victor.economy + 0.05);
      loser.economy = Math.max(0, loser.economy - 0.1);
      loser.stability = Math.max(0, loser.stability - 0.1);
      // Wars accelerate military technology.
      victor.techLevel = Math.min(victor.techLevel + (chance(world.rng, "war", 0.3) ? 1 : 0), 49);
      setRelation(world, attacker.id, defender.id, -0.4);
      loser.memory.grievances.push({ civId: victor.id, weight: 0.4, tick: world.tick });
      emitEvent(world, {
        type: WorldEventType.WarEnded,
        civIds: [attacker.id, defender.id],
        payload: {
          victor: victor.name,
          casualties: Math.round(war.casualties),
          reason: war.reason,
          treaty: "reparations",
        },
        causes: war.causeEvents,
        contributionId: war.contributionId,
        importance: 0.8,
      });
    }
  }

  // Relations drift toward the mean; trade partners warm up.
  for (const key of Object.keys(world.relations)) {
    const v = world.relations[key] ?? 0;
    world.relations[key] = v * 0.999;
  }
  void getRelation;
  void setRelation;
}
