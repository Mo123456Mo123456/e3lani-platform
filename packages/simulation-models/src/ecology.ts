import { SeededRng, clamp } from "./rng.js";

export type SpeciesTraits = {
  size: number;
  lifespan: number;
  reproductionRate: number;
  foodNeed: number;
  heatResistance: number;
  coldResistance: number;
  waterNeed: number;
  intelligence: number;
  aggression: number;
  mobility: number;
  adaptability: number;
  mutationRate: number;
  extinctionRisk: number;
};

export type SpeciesState = {
  id: string;
  name: string;
  population: number;
  traits: SpeciesTraits;
  habitatBiomes: string[];
  trophicLevel: number; // 0 plant-eater .. 1 apex
  regionIds: string[];
};

/**
 * Discrete Lotka–Volterra inspired update with carrying capacity.
 */
export function stepSpeciesPopulations(
  species: SpeciesState[],
  carryingByRegion: Map<string, number>,
  foodWeb: Map<string, string[]>, // predator -> prey ids
  rng: SeededRng,
  dt = 1,
): { next: SpeciesState[]; extinctions: string[]; mutations: SpeciesState[] } {
  const next = species.map((s) => ({ ...s, traits: { ...s.traits }, regionIds: [...s.regionIds] }));
  const extinctions: string[] = [];
  const mutations: SpeciesState[] = [];
  const byId = new Map(next.map((s) => [s.id, s]));

  for (const s of next) {
    const capacity =
      s.regionIds.reduce((acc, r) => acc + (carryingByRegion.get(r) ?? 100), 0) || 100;
    const preyIds = foodWeb.get(s.id) ?? [];
    let foodFactor = 0.6;
    if (preyIds.length > 0) {
      const preyPop = preyIds.reduce((a, id) => a + (byId.get(id)?.population ?? 0), 0);
      foodFactor = clamp(preyPop / (s.population * s.traits.foodNeed * 2 + 1), 0.1, 1.5);
    }

    const growth =
      s.traits.reproductionRate *
      foodFactor *
      (1 - s.population / capacity) *
      (1 - s.traits.extinctionRisk * 0.2);

    // Predation pressure
    let predation = 0;
    for (const [predId, prey] of foodWeb) {
      if (!prey.includes(s.id)) continue;
      const pred = byId.get(predId);
      if (!pred) continue;
      predation += (pred.population * pred.traits.aggression * 0.002) / Math.max(1, s.population);
    }

    s.population = Math.max(
      0,
      Math.floor(s.population + s.population * growth * dt - s.population * predation * dt),
    );

    if (s.population <= 0) {
      extinctions.push(s.id);
      continue;
    }

    // Rare mutation
    if (rng.chance(s.traits.mutationRate * 0.05 * dt) && s.population > 50) {
      const mutated: SpeciesState = {
        ...s,
        id: `${s.id}-m${rng.int(1000, 9999)}`,
        name: `${s.name} (متحوّل)`,
        population: Math.floor(s.population * 0.1),
        traits: {
          ...s.traits,
          adaptability: clamp(s.traits.adaptability + rng.float(-0.1, 0.15), 0, 1),
          heatResistance: clamp(s.traits.heatResistance + rng.float(-0.1, 0.1), 0, 1),
          coldResistance: clamp(s.traits.coldResistance + rng.float(-0.1, 0.1), 0, 1),
          mutationRate: clamp(s.traits.mutationRate + rng.float(-0.05, 0.05), 0, 1),
        },
      };
      s.population -= mutated.population;
      mutations.push(mutated);
    }
  }

  const surviving = next.filter((s) => s.population > 0);
  return { next: [...surviving, ...mutations], extinctions, mutations };
}

export function habitatSuitability(
  traits: SpeciesTraits,
  temperature: number,
  moisture: number,
): number {
  const heatOk = 1 - Math.abs(temperature - (0.3 + traits.heatResistance * 0.5));
  const coldOk = traits.coldResistance * (1 - temperature);
  const waterOk = 1 - Math.abs(moisture - traits.waterNeed);
  return clamp((heatOk + coldOk + waterOk) / 3, 0, 1);
}
