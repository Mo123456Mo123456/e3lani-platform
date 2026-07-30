import { SeededRng, clamp } from "./rng.js";

export type CivilizationState = {
  id: string;
  name: string;
  population: number;
  cities: number;
  techLevel: number;
  military: number;
  food: number;
  economy: number;
  health: number;
  stability: number;
  education: number;
  pollution: number;
  happiness: number;
  innovation: number;
  aggression: number;
  regionIds: string[];
  enemies: string[];
  allies: string[];
  memory: Array<{ kind: string; targetId?: string; tick: number; weight: number }>;
};

export type CivAction =
  | { type: "expand"; regionId: string }
  | { type: "trade"; targetId: string }
  | { type: "ally"; targetId: string }
  | { type: "war"; targetId: string }
  | { type: "research" }
  | { type: "build_city" }
  | { type: "migrate"; regionId: string }
  | { type: "heal" }
  | { type: "idle" };

function utilityExpand(civ: CivilizationState): number {
  return (civ.population / 1000) * (1 - civ.stability * 0.2) * (civ.food > 0.4 ? 1 : 0.3);
}

function utilityWar(civ: CivilizationState, target?: CivilizationState): number {
  if (!target) return 0;
  const resourcePressure = clamp(1 - civ.food, 0, 1);
  const hatred =
    civ.memory
      .filter((m) => m.targetId === target.id && m.kind === "attacked")
      .reduce((a, m) => a + m.weight, 0) / 3;
  const balance = civ.military / Math.max(0.1, target.military);
  const allyPenalty = civ.allies.includes(target.id) ? -2 : 0;
  return (
    civ.aggression * 0.4 +
    resourcePressure * 0.3 +
    hatred * 0.4 +
    clamp(balance - 0.8, -0.3, 0.4) +
    allyPenalty
  );
}

function utilityResearch(civ: CivilizationState): number {
  return civ.education * 0.4 + civ.innovation * 0.4 + (1 - civ.techLevel) * 0.3;
}

function utilityTrade(civ: CivilizationState): number {
  return civ.economy * 0.3 + (1 - civ.aggression) * 0.2 + civ.stability * 0.2;
}

/**
 * Utility AI decision for a civilization — deterministic given RNG state.
 */
export function decideCivilizationAction(
  civ: CivilizationState,
  others: CivilizationState[],
  freeRegions: string[],
  rng: SeededRng,
): CivAction {
  const candidates: Array<{ action: CivAction; score: number }> = [
    { action: { type: "idle" }, score: 0.1 },
    { action: { type: "research" }, score: utilityResearch(civ) },
    { action: { type: "heal" }, score: (1 - civ.health) * 0.8 },
    { action: { type: "build_city" }, score: civ.food > 0.5 && civ.population > 5000 ? 0.55 : 0.1 },
  ];

  if (freeRegions.length > 0) {
    candidates.push({
      action: { type: "expand", regionId: rng.pick(freeRegions) },
      score: utilityExpand(civ),
    });
    if (civ.population > 8000 && civ.food < 0.35) {
      candidates.push({
        action: { type: "migrate", regionId: rng.pick(freeRegions) },
        score: 0.6,
      });
    }
  }

  for (const other of others) {
    if (other.id === civ.id) continue;
    candidates.push({
      action: { type: "trade", targetId: other.id },
      score: utilityTrade(civ) * (civ.allies.includes(other.id) ? 1.2 : 0.8),
    });
    candidates.push({
      action: { type: "ally", targetId: other.id },
      score: (1 - civ.aggression) * 0.35 * (other.stability > 0.5 ? 1 : 0.5),
    });
    candidates.push({
      action: { type: "war", targetId: other.id },
      score: utilityWar(civ, other),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  // Softmax-ish pick among top 3 for variety but still seeded
  const top = candidates.slice(0, 3);
  const weights = top.map((c) => Math.max(0.01, c.score + 0.05));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return top[i]!.action;
  }
  return top[0]?.action ?? { type: "idle" };
}

export function applyCivilizationAction(
  civ: CivilizationState,
  action: CivAction,
  others: Map<string, CivilizationState>,
  tick: number,
): { events: Array<{ type: string; title: string; importance: number; meta: Record<string, unknown> }> } {
  const events: Array<{ type: string; title: string; importance: number; meta: Record<string, unknown> }> = [];

  switch (action.type) {
    case "research":
      civ.techLevel = clamp(civ.techLevel + 0.02 * civ.innovation, 0, 1);
      civ.education = clamp(civ.education + 0.01, 0, 1);
      if (civ.techLevel > 0 && Math.floor(civ.techLevel * 50) % 5 === 0) {
        events.push({
          type: "TECHNOLOGY_DISCOVERED",
          title: `اكتشاف تقني في ${civ.name}`,
          importance: 0.55,
          meta: { civilizationId: civ.id, techLevel: civ.techLevel },
        });
      }
      break;
    case "build_city":
      civ.cities += 1;
      civ.economy = clamp(civ.economy + 0.03, 0, 1);
      civ.population += 500;
      events.push({
        type: "CITY_CREATED",
        title: `مدينة جديدة في ${civ.name}`,
        importance: 0.5,
        meta: { civilizationId: civ.id, cities: civ.cities },
      });
      break;
    case "expand":
      if (!civ.regionIds.includes(action.regionId)) {
        civ.regionIds.push(action.regionId);
        civ.stability = clamp(civ.stability - 0.02, 0, 1);
        events.push({
          type: "CIVILIZATION_FOUNDED",
          title: `توسيع حدود ${civ.name}`,
          importance: 0.4,
          meta: { civilizationId: civ.id, regionId: action.regionId },
        });
      }
      break;
    case "migrate":
      events.push({
        type: "MIGRATION_STARTED",
        title: `هجرة من ${civ.name}`,
        importance: 0.55,
        meta: { civilizationId: civ.id, regionId: action.regionId },
      });
      civ.population = Math.floor(civ.population * 0.95);
      break;
    case "ally": {
      const other = others.get(action.targetId);
      if (other && !civ.allies.includes(other.id) && !civ.enemies.includes(other.id)) {
        civ.allies.push(other.id);
        other.allies.push(civ.id);
        events.push({
          type: "ALLIANCE_CREATED",
          title: `تحالف بين ${civ.name} و${other.name}`,
          importance: 0.6,
          meta: { a: civ.id, b: other.id },
        });
      }
      break;
    }
    case "trade": {
      const other = others.get(action.targetId);
      if (other) {
        civ.economy = clamp(civ.economy + 0.02, 0, 1);
        other.economy = clamp(other.economy + 0.015, 0, 1);
        events.push({
          type: "TRADE_ROUTE_CREATED",
          title: `طريق تجاري: ${civ.name} ↔ ${other.name}`,
          importance: 0.35,
          meta: { a: civ.id, b: other.id },
        });
      }
      break;
    }
    case "war": {
      const other = others.get(action.targetId);
      if (!other || civ.allies.includes(other.id)) break;
      const powerA = civ.military * (0.7 + civ.techLevel * 0.3) * Math.sqrt(civ.population);
      const powerB = other.military * (0.7 + other.techLevel * 0.3) * Math.sqrt(other.population);
      const ratio = powerA / Math.max(1, powerA + powerB);
      const lossesA = Math.floor(civ.population * 0.02 * (1 - ratio));
      const lossesB = Math.floor(other.population * 0.02 * ratio);
      civ.population = Math.max(100, civ.population - lossesA);
      other.population = Math.max(100, other.population - lossesB);
      civ.stability = clamp(civ.stability - 0.05, 0, 1);
      other.stability = clamp(other.stability - 0.06, 0, 1);
      civ.enemies = Array.from(new Set([...civ.enemies, other.id]));
      other.enemies = Array.from(new Set([...other.enemies, civ.id]));
      civ.memory.push({ kind: "attacked", targetId: other.id, tick, weight: 0.8 });
      other.memory.push({ kind: "attacked", targetId: civ.id, tick, weight: 1 });
      events.push({
        type: "WAR_STARTED",
        title: `حرب بين ${civ.name} و${other.name}`,
        importance: 0.9,
        meta: { a: civ.id, b: other.id, lossesA, lossesB, ratio },
      });
      break;
    }
    case "heal":
      civ.health = clamp(civ.health + 0.05, 0, 1);
      break;
    default:
      break;
  }

  // Natural demographics
  civ.population = Math.max(
    50,
    Math.floor(civ.population * (1 + (civ.food - 0.4) * 0.02 + (civ.health - 0.4) * 0.01)),
  );
  civ.pollution = clamp(civ.pollution + civ.techLevel * 0.005 - 0.002, 0, 1);
  civ.happiness = clamp(
    (civ.food + civ.health + civ.stability + (1 - civ.pollution)) / 4,
    0,
    1,
  );

  return { events };
}
