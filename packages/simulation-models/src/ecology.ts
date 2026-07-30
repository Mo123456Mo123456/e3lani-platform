/**
 * Ecology: food web, carrying capacity, population growth, habitat suitability.
 */

import type { BiomeId } from "@planet/shared-types";
import type { Population } from "./ecs.js";

export interface HabitatContext {
  biome: BiomeId;
  temperature: number;
  moisture: number;
  elevation: number;
  pollution: number;
}

export interface FoodWebEdge {
  predatorId: string;
  preyId: string;
  strength: number;
}

export interface FoodWeb {
  edges: FoodWebEdge[];
}

const BIOME_BASE_CAPACITY: Record<BiomeId, number> = {
  ocean: 8000,
  coast: 5000,
  plains: 6000,
  rainforest: 9000,
  temperate_forest: 7000,
  desert: 1500,
  mountain: 2000,
  tundra: 1200,
  swamp: 4500,
  steppe: 4000,
  volcanic: 800,
  ice: 400,
};

export function habitatSuitability(
  traits: {
    habitatPreference?: BiomeId[];
    adaptability: number;
    size: number;
  },
  ctx: HabitatContext,
): number {
  const prefs = traits.habitatPreference?.length
    ? traits.habitatPreference
    : (["plains", "temperate_forest", "coast"] as BiomeId[]);
  const biomeMatch = prefs.includes(ctx.biome) ? 1 : 0.35;
  const adapt = traits.adaptability;
  const pollutionPenalty = Math.max(0, 1 - ctx.pollution * 1.2);
  const sizePenalty = Math.max(0.4, 1 - Math.max(0, traits.size - 0.7) * 0.5);
  // mild temp/moisture preference around mid values unless adapted
  const comfort = 1 - 0.3 * Math.abs(ctx.temperature - 0.5) - 0.2 * Math.abs(ctx.moisture - 0.5);
  const score =
    biomeMatch * (0.5 + 0.5 * adapt) * pollutionPenalty * sizePenalty * Math.max(0.2, comfort);
  return Math.min(1, Math.max(0, score));
}

export function carryingCapacity(
  basePopulationPotential: number,
  suitability: number,
  biome: BiomeId,
  resourceAbundance = 1,
): number {
  const biomeCap = BIOME_BASE_CAPACITY[biome] ?? 3000;
  return Math.max(1, basePopulationPotential * suitability * (biomeCap / 5000) * resourceAbundance);
}

/**
 * Logistic growth with optional predation pressure.
 * dN/dt = r N (1 - N/K) - predation
 */
export function populationGrowth(
  pop: Population,
  dt: number,
  suitability: number,
  predationLoss = 0,
): number {
  const K = Math.max(1, pop.carryingCapacity * Math.max(0.05, suitability));
  const r = pop.growthRate;
  const N = Math.max(0, pop.count);
  const logistic = r * N * (1 - N / K);
  const next = N + (logistic - predationLoss) * dt;
  return Math.max(0, next);
}

/**
 * Lotka–Volterra inspired coupled step for one predator-prey pair.
 */
export function lotkaVolterraStep(
  prey: number,
  predator: number,
  params: {
    preyGrowth: number;
    predationRate: number;
    predatorEfficiency: number;
    predatorDeath: number;
    preyCapacity: number;
  },
  dt: number,
): { prey: number; predator: number } {
  const { preyGrowth, predationRate, predatorEfficiency, predatorDeath, preyCapacity } = params;
  const preyLogistic = preyGrowth * prey * (1 - prey / Math.max(1, preyCapacity));
  const dPrey = preyLogistic - predationRate * prey * predator;
  const dPred = predatorEfficiency * predationRate * prey * predator - predatorDeath * predator;
  return {
    prey: Math.max(0, prey + dPrey * dt),
    predator: Math.max(0, predator + dPred * dt),
  };
}

export function buildFoodWeb(
  species: Array<{ id: string; diet: string; size: number; aggression: number }>,
): FoodWeb {
  const edges: FoodWebEdge[] = [];
  const producers = species.filter((s) => s.diet === "producer");
  const herbivores = species.filter((s) => s.diet === "herbivore" || s.diet === "omnivore");
  const carnivores = species.filter((s) => s.diet === "carnivore" || s.diet === "omnivore");

  for (const h of herbivores) {
    for (const p of producers) {
      edges.push({
        predatorId: h.id,
        preyId: p.id,
        strength: 0.3 + 0.4 * h.size,
      });
    }
  }
  for (const c of carnivores) {
    for (const h of herbivores) {
      if (c.id === h.id) continue;
      if (c.size + 0.15 < h.size && c.aggression < 0.6) continue;
      edges.push({
        predatorId: c.id,
        preyId: h.id,
        strength: 0.2 + 0.5 * c.aggression * Math.min(1, c.size / Math.max(0.1, h.size)),
      });
    }
  }
  return { edges };
}

export function predationPressure(
  web: FoodWeb,
  populations: Map<string, number>,
  speciesId: string,
): number {
  let loss = 0;
  for (const e of web.edges) {
    if (e.preyId !== speciesId) continue;
    const pred = populations.get(e.predatorId) ?? 0;
    const prey = populations.get(speciesId) ?? 0;
    loss += e.strength * pred * Math.min(1, prey / 100) * 0.01;
  }
  return loss;
}
