import type {
  ContributionAnalysis,
  FutureScenario,
  PlanetRegion,
  WorldState,
} from "@planet/shared-types";
import { SeededRandom } from "./random.js";

export * from "./engine.js";
export * from "./random.js";
export * from "./world-generator.js";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

export function forecastContribution(
  state: WorldState,
  analysis: ContributionAnalysis,
  region: PlanetRegion,
  paths = 64,
): FutureScenario[] {
  const horizons = [1, 10, 100, 1000] as const;
  return horizons.map((horizonYears) => {
    const outcomes = Array.from({ length: paths }, (_, path) => {
      const random = new SeededRandom(
        `${state.seed}:forecast:${state.version}:${analysis.name}:${region.id}:${horizonYears}:${path}`,
      );
      const biomeFit = analysis.possibleBiomes.includes(region.biome) ? 1 : 0.18;
      const growth = analysis.traits.growthRate ?? analysis.traits.reproductionRate ?? 0.22;
      const adaptability = analysis.traits.adaptability ?? 0.42;
      const pollutionAbsorption = analysis.traits.pollutionAbsorption ?? 0;
      const waterNeed = analysis.traits.waterNeed ?? 0.35;
      const climateShock = random.between(-0.2, 0.2) * Math.log10(horizonYears + 1);
      const establishment = clamp(
        biomeFit * 0.58 + growth * 0.2 + adaptability * 0.22 + climateShock,
      );
      const spread = clamp(
        establishment * Math.log10(horizonYears + 1) * random.between(0.28, 0.58),
      );
      return {
        establishment,
        spread,
        pollutionDelta: -pollutionAbsorption * spread * 0.28,
        waterDelta: -waterNeed * spread * 0.19,
        economyDelta:
          (analysis.traits.energyYield ?? analysis.traits.utility ?? 0.2) *
          spread *
          random.between(0.08, 0.32),
      };
    });
    const keys = [
      "establishment",
      "spread",
      "pollutionDelta",
      "waterDelta",
      "economyDelta",
    ] as const;
    const aggregate = (ratio: number) =>
      Object.fromEntries(
        keys.map((key) => [key, Number(percentile(outcomes.map((outcome) => outcome[key]), ratio).toFixed(4))]),
      );
    const uncertainty =
      percentile(
        outcomes.map((outcome) => outcome.spread),
        0.9,
      ) -
      percentile(
        outcomes.map((outcome) => outcome.spread),
        0.1,
      );
    return {
      horizonYears,
      likely: aggregate(0.5),
      best: aggregate(0.9),
      worst: aggregate(0.1),
      uncertainty: Number(uncertainty.toFixed(4)),
      influentialFactors: [
        `biome:${region.biome}`,
        `water:${region.surfaceWater.toFixed(2)}`,
        `adaptability:${adaptability.toFixed(2)}`,
        ...analysis.risks.slice(0, 3),
      ],
    };
  });
}
