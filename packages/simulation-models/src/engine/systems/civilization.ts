/**
 * Civilization system — agent-based societies driven by Utility AI.
 *
 * Each civ per tick:
 *   produces/consumes food, extracts tech-gated resources, accumulates
 *   research, evaluates its health/stability, then scores a set of strategic
 *   actions (expand, found city, trade outreach, ally, war, conserve,
 *   migrate) and executes the best one. Decisions are functions of needs,
 *   risks, geography and remembered grievances — never coin flips.
 */
import type { Civilization, Disease } from "@planet/shared-types";
import { clamp, clamp01 } from "../../noise";
import { generateName } from "../../names";
import { BIOME_HABITABLE } from "../../worldgen/biomes";
import { foundCivilization } from "../genesis";
import { buildOwnershipIndex, nextEntityId, type WorldState } from "../state";
import type { SystemCtx } from "../engine";
import type { Rng } from "../../rng";

const MAX_CIVILIZATIONS = 14;

export function civilizationSystem(ctx: SystemCtx): void {
  const { state } = ctx;
  const ownership = buildOwnershipIndex(state);

  for (const civ of state.civs) {
    if (civ.collapsedAtTick !== null) continue;
    const cells = ownership.get(civ.id) ?? [];
    if (cells.length === 0) {
      collapseCivilization(ctx, civ, "lost all territory");
      continue;
    }
    sustainEconomy(ctx, civ, cells);
    advanceResearch(ctx, civ);
    updateWellbeing(ctx, civ, cells);
    maybeDisease(ctx, civ);
    decide(ctx, civ, cells);
    maybeCollapse(ctx, civ);
  }

  maybeFoundNewCivilization(ctx);
}

// ---------------------------------------------------------------------------
// Subsistence & extraction
// ---------------------------------------------------------------------------

export function techBonus(civ: Civilization, state: WorldState, key: string): number {
  let bonus = 1;
  for (const id of civ.discoveredTechIds) {
    const tech = state.techs.find((t) => t.id === id);
    if (tech?.effects[key]) bonus = Math.max(bonus, tech.effects[key]!);
  }
  return bonus;
}

function sustainEconomy(ctx: SystemCtx, civ: Civilization, cells: number[]): void {
  const { state, emit } = ctx;
  const grid = state.grid;
  const farming = techBonus(civ, state, "farming");

  let production = 0;
  for (const idx of cells) {
    const cell = grid.cells[idx]!;
    production += cell.fertility * 9 * farming;
  }
  const consumption = civ.population * 0.02;
  civ.food += production - consumption;

  const capacity = cells.reduce((sum, idx) => sum + grid.cells[idx]!.fertility * 320, 0);
  if (civ.food < 0) {
    civ.food = 0;
    civ.population = Math.max(0, Math.round(civ.population * 0.965));
    civ.stability = clamp01(civ.stability - 0.03);
    civ.happiness = clamp01(civ.happiness - 0.02);
    if (ctx.rng.chance(0.08)) {
      emit({
        type: "MIGRATION_STARTED",
        cell: cells[0]!,
        causeIds: [],
        cause: "famine pushed people toward more fertile land",
        actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
        data: { reason: "famine" },
        importance: 0.4,
      });
    }
  } else if (civ.population < capacity) {
    civ.population = Math.round(civ.population * (1 + 0.012 * civ.happiness + 0.008));
    civ.happiness = clamp01(civ.happiness + 0.004);
  }
  // population never exceeds regional carrying capacity
  civ.population = Math.min(civ.population, Math.max(60, Math.round(capacity)));

  // --- resource extraction, tech-gated -------------------------------------
  const industry = techBonus(civ, state, "industry");
  for (const idx of cells) {
    const cell = grid.cells[idx]!;
    for (const deposit of cell.resources) {
      const gate = resourceTechGate(deposit.type);
      if (!deposit.discovered && civ.techLevel >= gate && ctx.rng.chance(0.1)) {
        deposit.discovered = true;
        emit({
          type: "RESOURCE_DISCOVERED",
          cell: idx,
          causeIds: [],
          cause: `${civ.name} prospectors identified ${deposit.type} deposits`,
          actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
          data: { resource: deposit.type },
          importance: 0.5,
        });
      }
      if (!deposit.discovered || civ.techLevel < gate || deposit.quantity <= 0) continue;
      const rate = Math.min(deposit.quantity, 2 * industry);
      deposit.quantity -= rate;
      civ.economy = clamp01(civ.economy + rate * deposit.value * 0.01);
      const dirty = deposit.type === "oil" || deposit.type === "coal" || deposit.type === "uranium";
      civ.pollution = clamp01(civ.pollution + rate * (dirty ? 0.004 : 0.001));
      cell.pollution = clamp01(cell.pollution + rate * (dirty ? 0.01 : 0.003));
      if (deposit.renewRate > 0) deposit.quantity = Math.min(deposit.quantity + deposit.renewRate * 10, 999);
      if (deposit.quantity <= 0.01) {
        deposit.quantity = 0;
        emit({
          type: "RESOURCE_DEPLETED",
          cell: idx,
          causeIds: [],
          cause: `extraction by ${civ.name} exhausted the ${deposit.type} deposit`,
          actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
          data: { resource: deposit.type },
          importance: 0.55,
        });
      }
    }
  }
}

function resourceTechGate(type: string): number {
  switch (type) {
    case "grain":
    case "timber":
    case "fish":
    case "fresh_water":
    case "fertile_soil":
      return 0;
    case "copper":
    case "iron":
      return 0.08;
    case "coal":
      return 0.25;
    case "gold":
    case "crystal":
      return 0.15;
    case "oil":
      return 0.45;
    case "uranium":
      return 0.7;
    default:
      return 0.1;
  }
}

// ---------------------------------------------------------------------------
// Research & wellbeing
// ---------------------------------------------------------------------------

function advanceResearch(ctx: SystemCtx, civ: Civilization): void {
  const { state, emit } = ctx;
  const points =
    civ.population * 0.00012 * (0.4 + civ.education) * (0.4 + civ.innovation) *
    (civ.stability > 0.3 ? 1 : 0.4);
  const nextTier = civ.discoveredTechIds.length;
  if (nextTier >= state.techs.length) return;
  const threshold = 12 * Math.pow(nextTier + 1, 1.6);
  civ.techLevel = clamp01(civ.techLevel + points / threshold);
  if (ctx.rng.chance(points / threshold * 3)) {
    const tech = state.techs[nextTier]!;
    civ.discoveredTechIds.push(tech.id);
    civ.education = clamp01(civ.education + 0.02);
    emit({
      type: "TECHNOLOGY_DISCOVERED",
      cell: civ.cityIds.length > 0 ? state.cities.find((c) => c.id === civ.cityIds[0])?.cell ?? -1 : -1,
      causeIds: [],
      cause: `sustained research investment by ${civ.name} (education ${round2(civ.education)})`,
      actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
      data: { technology: tech.name, tier: tech.tier },
      importance: 0.55,
    });
  }
}

function updateWellbeing(ctx: SystemCtx, civ: Civilization, cells: number[]): void {
  const { state } = ctx;
  const medicine = techBonus(civ, state, "medicine");
  const localPollution =
    cells.reduce((sum, idx) => sum + state.grid.cells[idx]!.pollution, 0) / Math.max(1, cells.length);
  civ.health = clamp01(0.55 * medicine - localPollution * 0.4 + civ.happiness * 0.1);
  civ.stability = clamp01(
    civ.stability + (civ.happiness - 0.5) * 0.01 + (civ.food > 200 ? 0.005 : -0.005),
  );
  civ.pollution = clamp01(civ.pollution * 0.985);
}

function maybeDisease(ctx: SystemCtx, civ: Civilization): void {
  const { state, rng, emit } = ctx;
  // active diseases progress
  for (const disease of state.diseases) {
    if (disease.endedAtTick !== null || !disease.affectedCivIds.includes(civ.id)) continue;
    const mortality = disease.severity * 0.02 * (1 - civ.health * 0.6);
    civ.population = Math.max(0, Math.round(civ.population * (1 - mortality)));
    civ.stability = clamp01(civ.stability - 0.01);
    if (state.tick - disease.startedAtTick > 8 + disease.severity * 20 || civ.health > 0.75) {
      disease.endedAtTick = state.tick;
      emit({
        type: "DISEASE_CONTAINED",
        cell: disease.originCell,
        causeIds: [],
        cause: civ.health > 0.75 ? "public health measures contained the outbreak" : "the outbreak burned itself out",
        actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
        data: { disease: disease.name },
        importance: 0.5,
      });
    }
  }
  // new outbreak: dense population + poor health
  const dense = civ.population / Math.max(1, civ.cityIds.length) > 700;
  if (!dense || civ.health > 0.45 || !rng.chance(0.02)) return;
  const origin = state.cities.find((c) => c.id === civ.cityIds[0]);
  const disease: Disease = {
    id: nextEntityId(state, "disease"),
    name: `${generateName(rng, 2)} blight`,
    severity: rng.range(0.3, 0.8),
    contagiousness: rng.range(0.3, 0.8),
    originCell: origin?.cell ?? -1,
    affectedCivIds: [civ.id],
    startedAtTick: state.tick,
    endedAtTick: null,
  };
  state.diseases.push(disease);
  emit({
    type: "DISEASE_OUTBREAK",
    cell: disease.originCell,
    causeIds: [],
    cause: `overcrowded cities with low public health (health ${round2(civ.health)})`,
    actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
    data: { disease: disease.name, severity: round2(disease.severity) },
    importance: 0.65,
  });
}

// ---------------------------------------------------------------------------
// Utility-AI decisions
// ---------------------------------------------------------------------------

interface Action {
  kind: "expand" | "build_city" | "trade" | "ally" | "war" | "conserve" | "migrate" | "govern";
  score: number;
  targetCell?: number;
  targetCivId?: string;
}

function decide(ctx: SystemCtx, civ: Civilization, cells: number[]): void {
  const { state, rng } = ctx;
  const grid = state.grid;
  const actions: Action[] = [];
  const others = state.civs.filter((c) => c.id !== civ.id && c.collapsedAtTick === null);

  // --- expand into unclaimed habitable frontier -----------------------------
  const frontier = new Set<number>();
  for (const idx of cells) {
    for (const n of grid.neighbors[idx]!) {
      const cell = grid.cells[n]!;
      if (!cell.ownerId && cell.height >= grid.seaLevel && BIOME_HABITABLE[cell.biome]) {
        frontier.add(n);
      }
    }
  }
  const capacity = cells.reduce((sum, idx) => sum + grid.cells[idx]!.fertility * 320, 0);
  const pressure = capacity > 0 ? civ.population / capacity : 1;
  if (frontier.size > 0) {
    actions.push({ kind: "expand", score: 0.25 + pressure * 0.5 + rng.next() * 0.05 });
  }

  // --- found a new city -------------------------------------------------------
  const cityless = cells.filter(
    (idx) =>
      grid.cells[idx]!.fertility > 0.3 &&
      !state.cities.some((c) => c.cell === idx && !c.destroyedAtTick),
  );
  // a civilization sustains roughly one city per five owned cells
  const cityCap = Math.max(1, Math.floor(cells.length / 5));
  if (
    cityless.length > 0 &&
    civ.cityIds.length < cityCap &&
    civ.population > 900 * (civ.cityIds.length + 1) &&
    civ.food > 400
  ) {
    actions.push({
      kind: "build_city",
      score: 0.32 + civ.economy * 0.2 + rng.next() * 0.05,
      targetCell: pickBestCell(state, cityless),
    });
  }

  // --- diplomacy & war --------------------------------------------------------
  for (const other of others) {
    const relation = civ.relations[other.id] ?? 0;
    const allied = state.alliances.some(
      (a) => !a.dissolvedAtTick && a.memberCivIds.includes(civ.id) && a.memberCivIds.includes(other.id),
    );
    const atWar = state.wars.some(
      (w) => !w.endedAtTick &&
        ((w.attackerCivId === civ.id && w.defenderCivId === other.id) ||
          (w.attackerCivId === other.id && w.defenderCivId === civ.id)),
    );

    if (!allied && !atWar && relation > 0.02) {
      actions.push({ kind: "trade", score: 0.3 + relation * 0.3 + civ.economy * 0.2, targetCivId: other.id });
    }
    if (!allied && relation > 0.45) {
      const sharedThreat = others.some(
        (t) => (civ.memory[t.id] ?? 0) > 0.3 && (other.memory[t.id] ?? 0) > 0.3,
      );
      if (sharedThreat || relation > 0.6) {
        actions.push({ kind: "ally", score: 0.35 + relation * 0.4, targetCivId: other.id });
      }
    }
    if (!allied && !atWar) {
      const grievance = civ.memory[other.id] ?? 0;
      const competition = resourceCompetition(state, civ, other);
      const adjacent = territoriesAdjacent(state, civ.id, other.id);
      const powerRatio =
        militaryPower(civ, state) / Math.max(0.05, militaryPower(other, state));
      const warScore =
        grievance * 0.55 +
        competition * 0.45 +
        civ.aggression * 0.3 +
        (adjacent ? 0.2 : -0.08) +
        (powerRatio > 1.4 ? 0.2 : powerRatio < 0.7 ? -0.2 : 0) -
        Math.max(0, relation) * 0.45 -
        civ.stability * 0.12;
      if (warScore > 0.45) {
        actions.push({ kind: "war", score: warScore, targetCivId: other.id });
      }
    }
  }

  // --- conservation & migration ----------------------------------------------
  if (civ.pollution > 0.45) {
    actions.push({ kind: "conserve", score: 0.3 + civ.pollution * 0.4 });
  }
  const droughtAtHome = cells.some((idx) => (state.climate.droughtStreak[idx] ?? 0) > 5);
  if (droughtAtHome) {
    actions.push({ kind: "migrate", score: 0.5 + rng.next() * 0.1 });
  }
  if (civ.stability < 0.25 && civ.government !== "republic" && civ.techLevel > 0.2) {
    actions.push({ kind: "govern", score: 0.35 + (0.3 - civ.stability) });
  }

  if (actions.length === 0) return;
  actions.sort((a, b) => b.score - a.score);
  execute(ctx, civ, actions[0]!, cells);
}

function execute(ctx: SystemCtx, civ: Civilization, action: Action, cells: number[]): void {
  const { state, rng, emit } = ctx;
  const grid = state.grid;
  switch (action.kind) {
    case "expand": {
      const frontier: number[] = [];
      for (const idx of cells) {
        for (const n of grid.neighbors[idx]!) {
          const cell = grid.cells[n]!;
          if (!cell.ownerId && cell.height >= grid.seaLevel && BIOME_HABITABLE[cell.biome]) {
            frontier.push(n);
          }
        }
      }
      const target = pickBestCell(state, frontier);
      if (target >= 0) grid.cells[target]!.ownerId = civ.id;
      break;
    }
    case "build_city": {
      const cell = action.targetCell!;
      const cityId = nextEntityId(state, "city");
      const city = {
        id: cityId,
        name: generateName(rng, 2),
        civId: civ.id,
        cell,
        population: Math.round(civ.population * 0.15),
        foundedAtTick: state.tick,
        destroyedAtTick: null,
      };
      state.cities.push(city);
      civ.cityIds.push(cityId);
      civ.food = Math.max(0, civ.food - 100);
      emit({
        type: "CITY_CREATED",
        cell,
        causeIds: [],
        cause: `population growth and surplus food enabled ${civ.name} to found a city`,
        actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
        data: { city: city.name },
        importance: 0.55,
      });
      break;
    }
    case "trade": {
      civ.relations[action.targetCivId!] = clamp((civ.relations[action.targetCivId!] ?? 0) + 0.05, -1, 1);
      // route creation itself happens in the economy system
      break;
    }
    case "ally": {
      const other = state.civs.find((c) => c.id === action.targetCivId)!;
      const existing = state.alliances.find(
        (a) => !a.dissolvedAtTick && a.memberCivIds.includes(other.id),
      );
      if (existing && !existing.memberCivIds.includes(civ.id)) {
        existing.memberCivIds.push(civ.id);
      } else if (!existing) {
        state.alliances.push({
          id: nextEntityId(state, "ally"),
          memberCivIds: [civ.id, other.id],
          createdAtTick: state.tick,
          dissolvedAtTick: null,
          reason: "mutual interest and trust",
        });
      }
      civ.relations[other.id] = clamp01((civ.relations[other.id] ?? 0) + 0.2);
      other.relations[civ.id] = clamp01((other.relations[civ.id] ?? 0) + 0.2);
      emit({
        type: "ALLIANCE_CREATED",
        cell: -1,
        causeIds: [],
        cause: `high mutual relations (${round2(civ.relations[other.id] ?? 0)}) and aligned interests`,
        actors: [
          { kind: "civilization", id: civ.id, name: civ.name },
          { kind: "civilization", id: other.id, name: other.name },
        ],
        data: {},
        importance: 0.6,
      });
      break;
    }
    case "war": {
      // hand the intent to the conflict system (validated & resolved there)
      state.climate.warIntents[civ.id] = action.targetCivId!;
      break;
    }
    case "conserve": {
      civ.pollution = clamp01(civ.pollution - 0.08);
      civ.economy = clamp01(civ.economy - 0.02);
      civ.happiness = clamp01(civ.happiness + 0.01);
      break;
    }
    case "migrate": {
      const origin = cells[0]!;
      const target = findSaferCell(state, cells);
      if (target >= 0) {
        state.migrations.push({
          id: nextEntityId(state, "mig"),
          civId: civ.id,
          speciesId: null,
          fromCell: origin,
          toCell: target,
          path: [origin, target],
          people: Math.round(civ.population * 0.1),
          startedAtTick: state.tick,
          reason: "drought",
        });
        emit({
          type: "MIGRATION_STARTED",
          cell: origin,
          causeIds: [],
          cause: "prolonged drought made the homeland unlivable",
          actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
          data: { toCell: target },
          importance: 0.5,
        });
      }
      break;
    }
    case "govern": {
      civ.government = "republic";
      civ.stability = clamp01(civ.stability + 0.15);
      civ.happiness = clamp01(civ.happiness + 0.05);
      emit({
        type: "GOVERNMENT_CHANGED",
        cell: -1,
        causeIds: [],
        cause: `${civ.name} transitioned to a republic after prolonged instability`,
        actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
        data: { government: civ.government },
        importance: 0.45,
      });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function militaryPower(civ: Civilization, state: WorldState): number {
  const tech = techBonus(civ, state, "military");
  return civ.military * tech * Math.log10(civ.population + 10) * (0.5 + civ.stability * 0.5);
}

function resourceCompetition(state: WorldState, a: Civilization, b: Civilization): number {
  const scarceTypes = new Set<string>();
  for (const cell of state.grid.cells) {
    if (cell.ownerId !== a.id) continue;
    for (const d of cell.resources) if (d.quantity > 0 && d.value > 0.5) scarceTypes.add(d.type);
  }
  if (scarceTypes.size === 0) return 0;
  let shared = 0;
  const seen = new Set<string>();
  for (const cell of state.grid.cells) {
    if (cell.ownerId !== b.id) continue;
    for (const d of cell.resources) {
      if (scarceTypes.has(d.type) && d.quantity > 0 && !seen.has(d.type)) {
        seen.add(d.type);
        shared += 0.18;
      }
    }
  }
  return clamp01(shared);
}

function territoriesAdjacent(state: WorldState, aId: string, bId: string): boolean {
  const grid = state.grid;
  for (const cell of grid.cells) {
    if (cell.ownerId !== aId) continue;
    for (const n of grid.neighbors[cell.index]!) {
      if (grid.cells[n]!.ownerId === bId) return true;
    }
  }
  return false;
}

function pickBestCell(state: WorldState, cells: number[]): number {
  let best = -1;
  let bestScore = -1;
  for (const idx of cells) {
    const score = state.grid.cells[idx]!.fertility;
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  }
  return best;
}

function findSaferCell(state: WorldState, cells: number[]): number {
  let best = -1;
  let bestScore = -1;
  for (const idx of cells) {
    const cell = state.grid.cells[idx]!;
    const score = cell.moisture + cell.fertility - (state.climate.droughtStreak[idx] ?? 0) * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  }
  return best;
}

function maybeCollapse(ctx: SystemCtx, civ: Civilization): void {
  if (civ.population >= 60 && civ.stability > 0.03) return;
  collapseCivilization(ctx, civ, civ.population < 60 ? "population collapsed" : "state stability collapsed");
}

function collapseCivilization(ctx: SystemCtx, civ: Civilization, reason: string): void {
  const { state, emit } = ctx;
  civ.collapsedAtTick = state.tick;
  for (const cell of state.grid.cells) {
    if (cell.ownerId === civ.id) cell.ownerId = null;
  }
  emit({
    type: "CIVILIZATION_COLLAPSED",
    cell: -1,
    causeIds: [],
    cause: reason,
    actors: [{ kind: "civilization", id: civ.id, name: civ.name }],
    data: { foundedAtTick: civ.foundedAtTick },
    importance: 0.75,
  });
}

function maybeFoundNewCivilization(ctx: SystemCtx): void {
  const { state, rng, emit } = ctx;
  const living = state.civs.filter((c) => c.collapsedAtTick === null).length;
  if (living >= MAX_CIVILIZATIONS || !rng.chance(0.02)) return;
  const candidates = state.grid.cells.filter(
    (c) =>
      !c.ownerId &&
      c.height >= state.grid.seaLevel &&
      BIOME_HABITABLE[c.biome] &&
      c.fertility > 0.45,
  );
  if (candidates.length === 0) return;
  foundCivilization(state, rng.fork("founding"), emit, rng.pick(candidates).index, null);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
