/**
 * Economy system — trade routes between civilizations.
 *
 * Routes are created when two civs hold decent relations, live within reach,
 * and own complementary resources. Paths come from A* over the terrain with
 * war-risk surcharges. Active routes feed both economies, improve relations,
 * and act as vectors for disease.
 */
import { clamp, clamp01 } from "../../noise";
import { findPath } from "../pathfinding";
import { nextEntityId, type WorldState } from "../state";
import type { SystemCtx } from "../engine";

const MAX_ROUTE_CELLS = 60;

export function economySystem(ctx: SystemCtx): void {
  const { state, rng, emit } = ctx;
  const civs = state.civs.filter((c) => c.collapsedAtTick === null);

  // --- maintain existing routes ---------------------------------------------
  for (const route of state.tradeRoutes) {
    if (!route.active) continue;
    const from = state.cities.find((c) => c.id === route.fromCityId);
    const to = state.cities.find((c) => c.id === route.toCityId);
    if (!from || !to || from.destroyedAtTick || to.destroyedAtTick) {
      route.active = false;
      continue;
    }
    const a = state.civs.find((c) => c.id === from.civId);
    const b = state.civs.find((c) => c.id === to.civId);
    if (!a || !b || a.collapsedAtTick !== null || b.collapsedAtTick !== null) {
      route.active = false;
      continue;
    }
    const atWar = state.wars.some(
      (w) => !w.endedAtTick &&
        ((w.attackerCivId === a.id && w.defenderCivId === b.id) ||
          (w.attackerCivId === b.id && w.defenderCivId === a.id)),
    );
    if (atWar) {
      route.active = false;
      continue;
    }
    const income = route.volume * 0.004;
    a.economy = clamp01(a.economy + income);
    b.economy = clamp01(b.economy + income);
    a.relations[b.id] = clamp((a.relations[b.id] ?? 0) + 0.004, -1, 1);
    b.relations[a.id] = clamp((b.relations[a.id] ?? 0) + 0.004, -1, 1);

    // diseases travel along trade routes
    for (const disease of state.diseases) {
      if (disease.endedAtTick !== null) continue;
      const aHas = disease.affectedCivIds.includes(a.id);
      const bHas = disease.affectedCivIds.includes(b.id);
      if (aHas !== bHas && rng.chance(disease.contagiousness * 0.2)) {
        disease.affectedCivIds.push(aHas ? b.id : a.id);
        emit({
          type: "DISEASE_OUTBREAK",
          cell: aHas ? to.cell : from.cell,
          causeIds: [],
          cause: `the ${disease.name} traveled along an active trade route`,
          actors: [{ kind: "civilization", id: aHas ? b.id : a.id, name: (aHas ? b : a).name }],
          data: { disease: disease.name, route: route.id },
          importance: 0.6,
        });
      }
    }
  }

  // --- open new routes ---------------------------------------------------------
  for (let i = 0; i < civs.length; i++) {
    for (let j = i + 1; j < civs.length; j++) {
      const a = civs[i]!;
      const b = civs[j]!;
      const relation = a.relations[b.id] ?? 0;
      if (relation < 0.05) continue;
      const exists = state.tradeRoutes.some((r) => {
        const ca = state.cities.find((c) => c.id === r.fromCityId);
        const cb = state.cities.find((c) => c.id === r.toCityId);
        if (!ca || !cb) return false;
        return r.active && ((ca.civId === a.id && cb.civId === b.id) || (ca.civId === b.id && cb.civId === a.id));
      });
      if (exists) continue;
      if (!complementaryResources(state, a.id, b.id)) continue;
      const cityA = richestCity(state, a.id);
      const cityB = richestCity(state, b.id);
      if (!cityA || !cityB) continue;

      const atWarWith = warEnemies(state);
      const path = findPath(state.grid, cityA.cell, cityB.cell, {
        passable: (cell) => state.grid.cells[cell]!.height >= state.grid.seaLevel || state.grid.cells[cell]!.biome === "coast",
        extraCost: (cell) => {
          const owner = state.grid.cells[cell]!.ownerId;
          if (!owner) return 0.2;
          if (owner === a.id || owner === b.id) return 0;
          if (atWarWith.has(owner)) return 4;
          return 1;
        },
        maxIterations: 8000,
      });
      if (!path || path.length > MAX_ROUTE_CELLS) continue;

      state.tradeRoutes.push({
        id: nextEntityId(state, "route"),
        fromCityId: cityA.id,
        toCityId: cityB.id,
        path,
        volume: rng.range(0.4, 1),
        createdAtTick: state.tick,
        active: true,
      });
      emit({
        type: "TRADE_ROUTE_CREATED",
        cell: cityA.cell,
        causeIds: [],
        cause: `complementary resources and warm relations (${round2(relation)}) between ${a.name} and ${b.name}`,
        actors: [
          { kind: "civilization", id: a.id, name: a.name },
          { kind: "civilization", id: b.id, name: b.name },
        ],
        data: { route: `${cityA.name} ↔ ${cityB.name}`, length: path.length },
        importance: 0.5,
      });
    }
  }
}

function complementaryResources(state: WorldState, aId: string, bId: string): boolean {
  const aTypes = resourceTypesOf(state, aId);
  const bTypes = resourceTypesOf(state, bId);
  for (const t of aTypes) if (!bTypes.has(t)) return true;
  for (const t of bTypes) if (!aTypes.has(t)) return true;
  return false;
}

function resourceTypesOf(state: WorldState, civId: string): Set<string> {
  const types = new Set<string>();
  for (const cell of state.grid.cells) {
    if (cell.ownerId !== civId) continue;
    for (const d of cell.resources) if (d.discovered && d.quantity > 0) types.add(d.type);
  }
  return types;
}

function richestCity(state: WorldState, civId: string) {
  const cities = state.cities.filter((c) => c.civId === civId && !c.destroyedAtTick);
  if (cities.length === 0) return null;
  return cities.reduce((best, c) => (c.population > best.population ? c : best));
}

function warEnemies(state: WorldState): Set<string> {
  const ids = new Set<string>();
  for (const war of state.wars) {
    if (war.endedAtTick) continue;
    ids.add(war.attackerCivId);
    ids.add(war.defenderCivId);
  }
  return ids;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
