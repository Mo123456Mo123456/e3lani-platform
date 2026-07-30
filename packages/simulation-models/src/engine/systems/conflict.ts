/**
 * Conflict system — wars and their resolution.
 *
 * Wars are declared by the civilization system as validated intents, then
 * resolved here battle by battle: force comparison weighted by technology,
 * terrain, logistics, morale and alliances. Wars produce casualties,
 * displacement, border shifts, city destruction, treaties and long memories.
 */
import type { Civilization, War } from "@planet/shared-types";
import { clamp, clamp01 } from "../../noise.js";
import { nextEntityId, type WorldState } from "../state.js";
import { techBonus } from "./civilization.js";
import type { SystemCtx } from "../engine.js";

export function conflictSystem(ctx: SystemCtx): void {
  processWarIntents(ctx);
  resolveActiveWars(ctx);
}

function processWarIntents(ctx: SystemCtx): void {
  const { state, emit } = ctx;
  const intents = state.climate.warIntents;
  for (const [attackerId, defenderId] of Object.entries(intents)) {
    const attacker = state.civs.find((c) => c.id === attackerId);
    const defender = state.civs.find((c) => c.id === defenderId);
    if (!attacker || !defender || attacker.collapsedAtTick !== null || defender.collapsedAtTick !== null)
      continue;
    const allied = state.alliances.some(
      (a) => !a.dissolvedAtTick && a.memberCivIds.includes(attackerId) && a.memberCivIds.includes(defenderId),
    );
    const already = state.wars.some(
      (w) => !w.endedAtTick &&
        ((w.attackerCivId === attackerId && w.defenderCivId === defenderId) ||
          (w.attackerCivId === defenderId && w.defenderCivId === attackerId)),
    );
    if (allied || already) continue;

    const grievance = attacker.memory[defenderId] ?? 0;
    const war: War = {
      id: nextEntityId(state, "war"),
      attackerCivId: attackerId,
      defenderCivId: defenderId,
      startedAtTick: state.tick,
      endedAtTick: null,
      cause: grievance > 0.3 ? "remembered grievances" : "resource competition and rivalry",
      battles: 0,
      casualties: 0,
    };
    state.wars.push(war);
    attacker.relations[defenderId] = -0.7;
    defender.relations[attackerId] = -0.7;
    defender.memory[attackerId] = clamp01((defender.memory[attackerId] ?? 0) + 0.5);
    emit({
      type: "WAR_STARTED",
      cell: borderCell(state, attackerId, defenderId),
      causeIds: [],
      cause: `${war.cause}; power ratio favored the attacker`,
      actors: [
        { kind: "civilization", id: attackerId, name: attacker.name },
        { kind: "civilization", id: defenderId, name: defender.name },
      ],
      data: { war: war.id, cause: war.cause },
      importance: 0.85,
    });
  }
  state.climate.warIntents = {};
}

function resolveActiveWars(ctx: SystemCtx): void {
  const { state, rng, emit } = ctx;
  for (const war of state.wars) {
    if (war.endedAtTick !== null) continue;
    const attacker = state.civs.find((c) => c.id === war.attackerCivId);
    const defender = state.civs.find((c) => c.id === war.defenderCivId);
    if (!attacker || !defender || attacker.collapsedAtTick !== null || defender.collapsedAtTick !== null) {
      war.endedAtTick = state.tick;
      continue;
    }

    // --- one battle per tick ------------------------------------------------
    war.battles++;
    const atkForce = force(attacker, state) * rng.range(0.85, 1.15);
    const defForce = force(defender, state) * terrainDefenseBonus(state, defender.id) * rng.range(0.85, 1.15);
    const ratio = atkForce / Math.max(0.01, atkForce + defForce);
    const atkLosses = Math.round(attacker.population * 0.01 * (1 - ratio) + 5);
    const defLosses = Math.round(defender.population * 0.01 * ratio + 5);
    attacker.population = Math.max(0, attacker.population - atkLosses);
    defender.population = Math.max(0, defender.population - defLosses);
    war.casualties += atkLosses + defLosses;
    attacker.stability = clamp01(attacker.stability - 0.008);
    defender.stability = clamp01(defender.stability - 0.012);
    attacker.economy = clamp01(attacker.economy - 0.008);
    defender.economy = clamp01(defender.economy - 0.01);

    // territory shifts when the attacker dominates
    if (ratio > 0.62 && rng.chance(0.35)) {
      flipBorderCells(ctx, war, defender, attacker);
    }

    // --- war termination ------------------------------------------------------
    const exhausted =
      attacker.stability < 0.15 || defender.stability < 0.15 ||
      attacker.population < 80 || defender.population < 80;
    const decisive = war.battles > 6 && (ratio > 0.72 || ratio < 0.28);
    const dragged = war.battles > 30;
    if (exhausted || decisive || dragged) {
      endWar(ctx, war, attacker, defender, ratio);
    }
  }
}

function force(civ: Civilization, state: WorldState): number {
  const tech = techBonus(civ, state, "military");
  const allies = state.alliances.filter(
    (a) => !a.dissolvedAtTick && a.memberCivIds.includes(civ.id),
  ).length;
  return civ.military * tech * Math.log10(civ.population + 10) * (0.6 + civ.stability * 0.4) * (1 + allies * 0.15);
}

function terrainDefenseBonus(state: WorldState, civId: string): number {
  let mountains = 0;
  let total = 0;
  for (const cell of state.grid.cells) {
    if (cell.ownerId !== civId) continue;
    total++;
    if (cell.biome === "mountains" || cell.biome === "rainforest" || cell.biome === "swamp") mountains++;
  }
  return 1 + (total > 0 ? (mountains / total) * 0.6 : 0);
}

function flipBorderCells(ctx: SystemCtx, war: War, loser: Civilization, winner: Civilization): void {
  const { state, rng, emit } = ctx;
  const grid = state.grid;
  const loserCells = grid.cells.filter((c) => c.ownerId === loser.id);
  const border = loserCells.filter((c) =>
    grid.neighbors[c.index]!.some((n) => {
      const owner = grid.cells[n]!.ownerId;
      return owner === winner.id || owner === null;
    }),
  );
  if (border.length === 0) return;
  const taken = rng.pick(border);
  taken.ownerId = winner.id;
  const city = state.cities.find((c) => c.cell === taken.index && !c.destroyedAtTick);
  if (city && rng.chance(0.4)) {
    city.destroyedAtTick = state.tick;
    loser.cityIds = loser.cityIds.filter((id) => id !== city.id);
    emit({
      type: "CITY_DESTROYED",
      cell: taken.index,
      causeIds: [],
      cause: `sack of ${city.name} during the war (${war.id})`,
      actors: [
        { kind: "civilization", id: winner.id, name: winner.name },
        { kind: "civilization", id: loser.id, name: loser.name },
      ],
      data: { city: city.name, war: war.id },
      importance: 0.8,
    });
  }
  // displacement
  state.migrations.push({
    id: nextEntityId(state, "mig"),
    civId: loser.id,
    speciesId: null,
    fromCell: taken.index,
    toCell: loserCells[0]?.index ?? taken.index,
    path: [taken.index],
    people: Math.round(loser.population * 0.05),
    startedAtTick: state.tick,
    reason: "war_displacement",
  });
}

function endWar(
  ctx: SystemCtx,
  war: War,
  attacker: Civilization,
  defender: Civilization,
  finalRatio: number,
): void {
  const { state, emit } = ctx;
  war.endedAtTick = state.tick;
  const attackerWon = finalRatio > 0.55;
  const winner = attackerWon ? attacker : defender;
  const loser = attackerWon ? defender : attacker;

  // reparations + memory: losers remember, winners gain
  const reparations = Math.min(0.15, loser.economy * 0.4);
  loser.economy = clamp01(loser.economy - reparations);
  winner.economy = clamp01(winner.economy + reparations);
  loser.memory[winner.id] = clamp01((loser.memory[winner.id] ?? 0) + 0.45);
  loser.stability = clamp01(loser.stability + 0.05); // peace relief
  winner.stability = clamp01(winner.stability + 0.08);
  attacker.relations[defender.id] = clamp((attacker.relations[defender.id] ?? 0) + 0.25, -1, 1);
  defender.relations[attacker.id] = clamp((defender.relations[attacker.id] ?? 0) + 0.25, -1, 1);

  emit({
    type: "WAR_ENDED",
    cell: borderCell(state, attacker.id, defender.id),
    causeIds: [],
    cause: attackerWon
      ? `${attacker.name} forced a decisive victory`
      : finalRatio < 0.45
        ? `${defender.name} repelled the invasion`
        : "mutual exhaustion led to a negotiated peace",
    actors: [
      { kind: "civilization", id: attacker.id, name: attacker.name },
      { kind: "civilization", id: defender.id, name: defender.name },
    ],
    data: {
      war: war.id,
      battles: war.battles,
      casualties: war.casualties,
      victor: winner.name,
    },
    importance: 0.8,
  });

  // post-war alliances sometimes form against the victor
  if (ctx.rng.chance(0.2)) {
    const rivals = state.civs.filter(
      (c) =>
        c.id !== winner.id &&
        c.collapsedAtTick === null &&
        (c.memory[winner.id] ?? 0) > 0.3,
    );
    if (rivals.length >= 2) {
      state.alliances.push({
        id: nextEntityId(state, "ally"),
        memberCivIds: rivals.slice(0, 3).map((r) => r.id),
        createdAtTick: state.tick,
        dissolvedAtTick: null,
        reason: `containment of ${winner.name}`,
      });
      emit({
        type: "ALLIANCE_CREATED",
        cell: -1,
        causeIds: [],
        cause: `shared fear of ${winner.name} after the war`,
        actors: rivals.slice(0, 3).map((r) => ({ kind: "civilization", id: r.id, name: r.name })),
        data: {},
        importance: 0.55,
      });
    }
  }
}

function borderCell(state: WorldState, aId: string, bId: string): number {
  const grid = state.grid;
  for (const cell of grid.cells) {
    if (cell.ownerId !== aId) continue;
    for (const n of grid.neighbors[cell.index]!) {
      if (grid.cells[n]!.ownerId === bId) return cell.index;
    }
  }
  return -1;
}
