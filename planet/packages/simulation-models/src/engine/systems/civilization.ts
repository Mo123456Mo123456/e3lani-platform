import { BiomeType, GovernmentType, ResourceKind, WorldEventType } from "@planet/shared-types";
import { clamp01, neighbors4 } from "../../math.js";
import { chance, pick, range, random } from "../../rng.js";
import { habitability } from "../../planet/biomes.js";
import { BIOME_ORDER } from "../../planet/types.js";
import { emitEvent } from "../events.js";
import { cityName, TECH_TIER_COUNT } from "../names.js";
import { ensureTech } from "../world.js";
import { getRelation, nextId, setRelation, type Civilization, type WorldState } from "../types.js";
import { findPath } from "../pathfind.js";

const DECISION_INTERVAL = 4; // civs reassess every N ticks

/**
 * Civilization agent system. Each civ scores candidate actions with a
 * utility function over its needs (food, resources, security, growth,
 * knowledge) and executes the best one — Utility AI, fully seeded.
 */
export function applyCivilizations(world: WorldState): void {
  for (const civ of world.civs) {
    if (civ.fallen) continue;
    updateNeeds(world, civ);
    if (civ.fallen) continue;
    growPopulation(world, civ);
    progressTechnology(world, civ);
    if (world.tick % DECISION_INTERVAL === (civ.id % DECISION_INTERVAL)) {
      decide(world, civ);
    }
    decayMemory(civ);
  }
  // A civ with no population and no cities falls.
  for (const civ of world.civs) {
    if (civ.fallen) continue;
    const cities = world.cities.filter((c) => c.civId === civ.id && !c.fallen);
    if (civ.population < 50 && cities.length === 0) {
      civ.fallen = true;
      emitEvent(world, {
        type: WorldEventType.CityFallen,
        civIds: [civ.id],
        payload: { civilization: civ.name, reason: "collapse" },
        importance: 0.75,
      });
    }
  }
}

function updateNeeds(world: WorldState, civ: Civilization): void {
  // Food: territory fertility feeds population; stockpiles buffer shortfalls.
  let production = 0;
  for (const cell of civ.cells) {
    production += (world.grid.fertility[cell] ?? 0) * 60;
  }
  const need = civ.population * 0.5;
  const stored = civ.stockpiles["food"] ?? 0;
  const balance = production + stored * 0.1 - need;
  civ.stockpiles["food"] = Math.max(0, stored + production - need);
  civ.foodSecurity = clamp01(0.5 + balance / Math.max(need, 1));
  if (civ.foodSecurity < 0.15) {
    civ.population *= 0.97; // famine
    civ.stability = Math.max(0, civ.stability - 0.02);
    civ.happiness = Math.max(0, civ.happiness - 0.02);
  }

  // Pollution from industry.
  const pollution = civ.pollutionOutput * (1 + civ.techLevel * 0.05) * (civ.population / 2000);
  for (const cell of civ.cells) {
    world.grid.pollution[cell] = clamp01((world.grid.pollution[cell] ?? 0) + pollution * 0.001);
  }
  civ.health = clamp01(civ.health - pollution * 0.0005 + civ.education * 0.0004);

  // Economy baseline from trade + resources.
  const deposits = world.deposits.filter((d) => !d.depleted && civ.cells.includes(d.cell));
  civ.economy = clamp01(civ.economy * 0.99 + deposits.length * 0.002 + civ.foodSecurity * 0.004);
}

function growPopulation(world: WorldState, civ: Civilization): void {
  const capacity = civ.cells.reduce((sum, cell) => {
    const b = BIOME_ORDER[world.grid.biome[cell] ?? 0] ?? BiomeType.Ocean;
    return sum + habitability(b) * 4000;
  }, 0);
  const growth = 1 + 0.01 * civ.foodSecurity * (1 - civ.population / Math.max(capacity, 1));
  civ.population = Math.max(0, civ.population * growth);
  const perCity = civ.population / Math.max(world.cities.filter((c) => c.civId === civ.id && !c.fallen).length, 1);
  for (const city of world.cities) {
    if (city.civId === civ.id && !city.fallen) city.population = perCity;
  }
}

function progressTechnology(world: WorldState, civ: Civilization): void {
  const rate = civ.curiosity * civ.education * civ.stability * 0.004;
  if (civ.techLevel < TECH_TIER_COUNT - 1 && chance(world.rng, "tech", rate * (1 + civ.techLevel * 0.1))) {
    civ.techLevel += 1;
    civ.education = clamp01(civ.education + 0.01);
    ensureTech(world, civ.techLevel, civ.id);
  }
}

interface Candidate {
  action: string;
  utility: number;
  target?: number;
}

function decide(world: WorldState, civ: Civilization): void {
  const candidates: Candidate[] = [];

  // --- Expand territory ----------------------------------------------------
  const frontier = frontierCells(world, civ);
  const pressure = civ.population / Math.max(civ.cells.length * 3000, 1);
  candidates.push({
    action: "expand",
    utility: civ.expansionism * 0.4 + pressure * 0.5 + civ.foodSecurity * 0.1,
    target: frontier.length > 0 ? frontier[Math.floor(random(world.rng, "decide") * frontier.length)] : undefined,
  });

  // --- Found a city ----------------------------------------------------------
  const cities = world.cities.filter((c) => c.civId === civ.id && !c.fallen);
  candidates.push({
    action: "found_city",
    utility: civ.cells.length > cities.length * 3 ? 0.5 + civ.economy * 0.3 : 0.05,
  });

  // --- Research investment ---------------------------------------------------
  candidates.push({ action: "research", utility: civ.curiosity * 0.5 + (1 - civ.techLevel / TECH_TIER_COUNT) * 0.2 });

  // --- Trade -----------------------------------------------------------------
  const tradePartner = world.civs.find(
    (o) => o.id !== civ.id && !o.fallen && getRelation(world, civ.id, o.id) > 0.15 && !atWar(world, civ.id, o.id),
  );
  candidates.push({
    action: "trade",
    utility: tradePartner ? 0.35 + civ.economy * 0.3 + getRelation(world, civ.id, tradePartner.id) * 0.2 : 0,
    target: tradePartner?.id,
  });

  // --- War -------------------------------------------------------------------
  let warTarget: Civilization | undefined;
  let warUtility = 0;
  const warReluctance = world.laws.find((l) => l.modifier === "warReluctance");
  for (const other of world.civs) {
    if (other.id === civ.id || other.fallen || atWar(world, civ.id, other.id)) continue;
    const tension = -getRelation(world, civ.id, other.id);
    const grievance = civ.memory.grievances.filter((g) => g.civId === other.id).reduce((s, g) => s + g.weight, 0);
    const border = civ.cells.some((cell) =>
      neighbors4(world.grid.width, world.grid.height, cell).some((n) => other.cells.includes(n)),
    );
    const resourceNeed = 1 - civ.foodSecurity;
    const militaryEdge = civ.military * (1 + civ.techLevel * 0.1) - other.military * (1 + other.techLevel * 0.1);
    let u = tension * 0.25 + grievance * 0.3 + (border ? 0.15 : 0) + resourceNeed * 0.2 + militaryEdge * 0.3 + civ.aggression * 0.2 - 0.55;
    if (warReluctance) u *= 1 - warReluctance.factor;
    if (u > warUtility) {
      warUtility = u;
      warTarget = other;
    }
  }
  candidates.push({ action: "war", utility: Math.max(0, warUtility), target: warTarget?.id });

  // --- Alliance ----------------------------------------------------------------
  const allyCandidate = world.civs.find(
    (o) =>
      o.id !== civ.id &&
      !o.fallen &&
      getRelation(world, civ.id, o.id) > 0.45 &&
      !world.alliances.some((a) => !a.brokenTick && a.civIds.includes(civ.id) && a.civIds.includes(o.id)),
  );
  candidates.push({
    action: "ally",
    utility: allyCandidate ? 0.3 + getRelation(world, civ.id, allyCandidate.id) * 0.4 : 0,
    target: allyCandidate?.id,
  });

  candidates.sort((a, b) => b.utility - a.utility);
  const best = candidates[0];
  if (!best || best.utility < 0.3) return;

  switch (best.action) {
    case "expand": {
      if (best.target !== undefined && !civ.cells.includes(best.target)) {
        civ.cells.push(best.target);
        civ.cells.sort((a, b) => a - b);
      }
      break;
    }
    case "found_city": {
      const options = civ.cells.filter((c) => !world.cities.some((city) => city.cell === c && !city.fallen));
      if (options.length === 0) break;
      const cell = pick(world.rng, "decide", options);
      const city = {
        id: nextId(world, "city"),
        name: cityName(world.rng, "decide"),
        civId: civ.id,
        cell,
        population: civ.population * 0.1,
        health: civ.health,
        foundedTick: world.tick,
        fallen: false,
      };
      world.cities.push(city);
      civ.population *= 0.98;
      emitEvent(world, {
        type: WorldEventType.CityCreated,
        cellIndex: cell,
        civIds: [civ.id],
        payload: { name: city.name },
        importance: 0.5,
      });
      break;
    }
    case "research": {
      civ.education = clamp01(civ.education + 0.02);
      civ.economy = Math.max(0, civ.economy - 0.005);
      break;
    }
    case "trade": {
      if (best.target === undefined) break;
      establishTrade(world, civ, best.target);
      break;
    }
    case "war": {
      if (best.target === undefined) break;
      startWar(world, civ, best.target, "utility");
      break;
    }
    case "ally": {
      if (best.target === undefined) break;
      const alliance = {
        id: nextId(world, "alliance"),
        civIds: [civ.id, best.target],
        createdTick: world.tick,
        causeEvents: [],
      };
      world.alliances.push(alliance);
      setRelation(world, civ.id, best.target, 0.8);
      civ.memory.pastAllies.push(best.target);
      emitEvent(world, {
        type: WorldEventType.AllianceCreated,
        civIds: [civ.id, best.target],
        payload: { members: alliance.civIds.map((id) => world.civs.find((c) => c.id === id)?.name) },
        importance: 0.55,
      });
      break;
    }
  }
}

export function frontierCells(world: WorldState, civ: Civilization): number[] {
  const owned = new Set(civ.cells);
  const out = new Set<number>();
  for (const cell of civ.cells) {
    for (const n of neighbors4(world.grid.width, world.grid.height, cell)) {
      if (owned.has(n)) continue;
      if ((world.grid.elevation[n] ?? 0) <= world.grid.seaLevel) continue;
      if (world.civs.some((o) => o.id !== civ.id && !o.fallen && o.cells.includes(n))) continue;
      out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function establishTrade(world: WorldState, civ: Civilization, partnerId: number): void {
  const partner = world.civs.find((c) => c.id === partnerId);
  if (!partner) return;
  const myCities = world.cities.filter((c) => c.civId === civ.id && !c.fallen);
  const theirCities = world.cities.filter((c) => c.civId === partner.id && !c.fallen);
  if (myCities.length === 0 || theirCities.length === 0) return;
  const from = myCities[0]!;
  const to = theirCities[0]!;
  if (world.tradeRoutes.some((r) => r.active && r.fromCity === from.id && r.toCity === to.id)) return;
  const path = findPath(world.grid, from.cell, to.cell, {
    cost: (cell) => 1 - (world.grid.fertility[cell] ?? 0),
  });
  if (!path) return;
  world.tradeRoutes.push({
    id: nextId(world, "trade"),
    fromCity: from.id,
    toCity: to.id,
    path,
    volume: 0.1 + civ.economy * 0.3,
    active: true,
    createdTick: world.tick,
  });
  civ.economy = clamp01(civ.economy + 0.03);
  partner.economy = clamp01(partner.economy + 0.03);
  setRelation(world, civ.id, partner.id, getRelation(world, civ.id, partner.id) + 0.05);
  emitEvent(world, {
    type: WorldEventType.TradeRouteCreated,
    cellIndex: from.cell,
    civIds: [civ.id, partner.id],
    payload: { from: from.name, to: to.name, length: path.length },
    importance: 0.4,
  });
}

export function startWar(world: WorldState, attacker: Civilization, defenderId: number, reason: string, causes: number[] = []): void {
  const defender = world.civs.find((c) => c.id === defenderId);
  if (!defender || atWar(world, attacker.id, defenderId)) return;
  const war = {
    id: nextId(world, "war"),
    attacker: attacker.id,
    defender: defenderId,
    startedTick: world.tick,
    casualties: 0,
    reason,
    causeEvents: causes,
    contributionId: attacker.contributionId,
  };
  world.wars.push(war);
  setRelation(world, attacker.id, defenderId, -1);
  defender.memory.grievances.push({ civId: attacker.id, weight: 0.5, tick: world.tick });
  emitEvent(world, {
    type: WorldEventType.WarStarted,
    civIds: [attacker.id, defenderId],
    cellIndex: defender.capitalCell,
    payload: { attacker: attacker.name, defender: defender.name, reason },
    causes,
    contributionId: attacker.contributionId ?? defender.contributionId,
    importance: 0.85,
  });
}

export function atWar(world: WorldState, a: number, b: number): boolean {
  return world.wars.some(
    (w) => w.endedTick === undefined &&
      ((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)),
  );
}

function decayMemory(civ: Civilization): void {
  for (const g of civ.memory.grievances) g.weight *= 0.999;
  civ.memory.grievances = civ.memory.grievances.filter((g) => g.weight > 0.02);
}

export { ResourceKind };
