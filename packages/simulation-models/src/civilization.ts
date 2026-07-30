/**
 * Civilization utility AI, war probability, and combat resolution.
 */

import { SeededRNG } from "./seeded-rng.js";

export type CivAction = "expand" | "trade" | "alliance" | "war" | "research" | "migrate";

export interface CivState {
  id: string;
  name: string;
  population: number;
  techLevel: number;
  militaryPower: number;
  economyStrength: number;
  aggression: number;
  expansionism: number;
  diplomacy: number;
  foodStock: number;
  regionIds: string[];
  resourceAccess: number;
  neighbors: string[];
}

export interface CivRelation {
  otherId: string;
  proximity: number;
  resourceConflict: number;
  warHistory: number;
  allianceStrength: number;
  tradeVolume: number;
}

export interface ActionScore {
  action: CivAction;
  score: number;
  reasons: string[];
}

export function scoreActions(civ: CivState, relations: CivRelation[]): ActionScore[] {
  const foodRatio = civ.foodStock / Math.max(1, civ.population * 0.01);
  const scores: ActionScore[] = [];

  scores.push({
    action: "expand",
    score:
      civ.expansionism * 0.5 +
      (1 - Math.min(1, civ.resourceAccess)) * 0.3 +
      (civ.population > 5000 ? 0.2 : 0),
    reasons: ["expansionism", "resource_pressure"],
  });

  const bestTrade = relations.reduce((m, r) => Math.max(m, r.tradeVolume + r.proximity * 0.3), 0);
  scores.push({
    action: "trade",
    score: civ.diplomacy * 0.4 + civ.economyStrength * 0.3 + bestTrade * 0.3,
    reasons: ["diplomacy", "economy"],
  });

  const allyCandidate = relations.reduce(
    (m, r) => Math.max(m, r.allianceStrength + r.proximity * 0.2 - r.warHistory),
    0,
  );
  scores.push({
    action: "alliance",
    score: civ.diplomacy * 0.5 + allyCandidate * 0.4 - civ.aggression * 0.2,
    reasons: ["diplomacy", "shared_interest"],
  });

  const warRisk = Math.max(...relations.map((r) => warProbability(civ, r)), 0);
  scores.push({
    action: "war",
    score: warRisk,
    reasons: ["resource_conflict", "military_balance"],
  });

  scores.push({
    action: "research",
    score: (1 - Math.min(1, civ.techLevel / 10)) * 0.5 + civ.economyStrength * 0.3 + 0.1,
    reasons: ["tech_gap", "economy"],
  });

  scores.push({
    action: "migrate",
    score:
      (foodRatio < 0.6 ? 0.6 : 0) +
      (civ.resourceAccess < 0.3 ? 0.3 : 0) +
      civ.expansionism * 0.1,
    reasons: ["food_shortage", "scarce_land"],
  });

  return scores.sort((a, b) => b.score - a.score);
}

export function chooseAction(civ: CivState, relations: CivRelation[], rng: SeededRNG): CivAction {
  const scored = scoreActions(civ, relations);
  // Softmax-ish weighted pick among top actions
  const weights = scored.map((s) => Math.exp(Math.max(-5, Math.min(5, s.score * 3))));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng.nextFloat() * sum;
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return scored[i]!.action;
  }
  return scored[0]!.action;
}

export function warProbability(civ: CivState, rel: CivRelation): number {
  const foodShortage = civ.foodStock < civ.population * 0.008 ? 0.35 : 0;
  const militaryBalance = Math.max(
    0,
    Math.min(1, civ.militaryPower / Math.max(0.1, 1 - rel.allianceStrength + 0.5)),
  );
  // Approximate opponent strength from conflict pressure
  const p =
    civ.aggression * 0.25 +
    rel.resourceConflict * 0.3 +
    rel.proximity * 0.15 +
    rel.warHistory * 0.1 +
    militaryBalance * 0.15 +
    foodShortage -
    rel.allianceStrength * 0.4 -
    civ.diplomacy * 0.1;
  return Math.min(1, Math.max(0, p));
}

export type WarOutcome = "attacker_win" | "defender_win" | "stalemate" | "truce";

export interface WarForces {
  militaryPower: number;
  techLevel: number;
  terrainAdvantage: number;
  morale: number;
  population: number;
}

export function resolveWar(
  attacker: WarForces,
  defender: WarForces,
  rng: SeededRNG,
): { outcome: WarOutcome; attackerLoss: number; defenderLoss: number } {
  const atk =
    attacker.militaryPower *
    (1 + attacker.techLevel * 0.15) *
    (1 + attacker.morale * 0.2) *
    (1 + attacker.terrainAdvantage * 0.1);
  const def =
    defender.militaryPower *
    (1 + defender.techLevel * 0.15) *
    (1 + defender.morale * 0.25) *
    (1 + defender.terrainAdvantage * 0.2);

  const noise = 0.85 + rng.nextFloat() * 0.3;
  const ratio = (atk * noise) / Math.max(0.01, def);

  let outcome: WarOutcome;
  if (ratio > 1.35) outcome = "attacker_win";
  else if (ratio < 0.72) outcome = "defender_win";
  else if (rng.nextFloat() < 0.35) outcome = "truce";
  else outcome = "stalemate";

  const intensity = Math.min(0.5, Math.abs(Math.log(ratio)) * 0.15 + 0.05);
  return {
    outcome,
    attackerLoss: Math.floor(attacker.population * intensity * (outcome === "attacker_win" ? 0.6 : 1.2)),
    defenderLoss: Math.floor(defender.population * intensity * (outcome === "defender_win" ? 0.6 : 1.2)),
  };
}
