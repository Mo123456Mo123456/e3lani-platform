import {
  FutureProjectionSchema,
  type FutureProjection,
  type FutureScenario,
  type ScenarioPoint,
  type WorldState,
  type WorldSummary,
} from "@kawkab/shared-types";

import { SeededRandom } from "./prng.js";
import { summarizeWorld } from "./snapshots.js";

export interface FutureProjectionOptions {
  horizonTicks: number;
  runs?: number;
  seed?: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function approximateNormal(random: SeededRandom): number {
  let total = 0;
  for (let index = 0; index < 6; index += 1) total += random.next();
  return (total - 3) / Math.sqrt(0.5);
}

function quantile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower] as number;
  const weight = position - lower;
  return (
    (sorted[lower] as number) * (1 - weight) +
    (sorted[upper] as number) * weight
  );
}

function runScenario(
  state: WorldState,
  horizonTicks: number,
  run: number,
  projectionSeed: string,
): FutureScenario {
  const random = new SeededRandom(`${projectionSeed}:run:${run}`);
  const populations = state.regions.map((region) => region.population);
  const pollution = state.regions.map((region) => region.pollution);
  let meanTemperatureC = state.climate.globalMeanTemperatureC;
  const trajectory: ScenarioPoint[] = [];
  const sampleInterval = Math.max(1, Math.ceil(horizonTicks / 32));

  const pointAt = (offset: number): ScenarioPoint => {
    const totalPopulation = populations.reduce(
      (total, population) => total + population,
      0,
    );
    const meanPollution =
      pollution.reduce((total, value) => total + value, 0) /
      Math.max(1, pollution.length);
    const temperatureStress = clamp(
      Math.abs(meanTemperatureC - 15) / 55,
      0,
      1,
    );
    return {
      tick: state.tick + offset,
      totalPopulation: round(totalPopulation),
      meanTemperatureC: round(meanTemperatureC),
      meanPollution: round(meanPollution),
      habitability: round(
        clamp(1 - temperatureStress * 0.55 - meanPollution * 0.45, 0, 1),
      ),
    };
  };

  trajectory.push(pointAt(0));
  for (let offset = 1; offset <= horizonTicks; offset += 1) {
    const climateNoise = approximateNormal(random) * 0.025;
    const carbonForcing =
      Math.max(0, state.climate.atmosphericCarbonPpm - 280) * 0.00001;
    meanTemperatureC = clamp(
      meanTemperatureC + climateNoise + carbonForcing,
      -100,
      100,
    );

    for (let index = 0; index < state.regions.length; index += 1) {
      const region = state.regions[index] as WorldState["regions"][number];
      const carryingCapacity = region.carryingCapacity;
      const currentPopulation = populations[index] as number;
      const currentPollution = pollution[index] as number;
      if (carryingCapacity > 0 && currentPopulation > 0) {
        const climateStress = clamp(
          Math.abs(
            region.temperatureC +
              (meanTemperatureC - state.climate.globalMeanTemperatureC) -
              18,
          ) / 75,
          0,
          0.9,
        );
        const stochasticGrowth = clamp(
          1 + approximateNormal(random) * 0.08,
          0.7,
          1.3,
        );
        const growth =
          currentPopulation *
          0.008 *
          (1 - currentPopulation / carryingCapacity) *
          (1 - climateStress) *
          (1 - currentPollution * 0.65) *
          stochasticGrowth;
        const rareLoss = random.chance(0.0015)
          ? currentPopulation * random.range(0.005, 0.035)
          : 0;
        populations[index] = clamp(
          currentPopulation + growth - rareLoss,
          0,
          carryingCapacity,
        );
      }

      const pressure =
        carryingCapacity > 0
          ? (populations[index] as number) / carryingCapacity
          : 0;
      pollution[index] = clamp(
        currentPollution +
          pressure * random.range(0, 0.00015) -
          (0.0002 + region.moisture * 0.0002),
        0,
        1,
      );
    }

    if (offset % sampleInterval === 0 || offset === horizonTicks) {
      trajectory.push(pointAt(offset));
    }
  }

  const finalPoint = trajectory[trajectory.length - 1] as ScenarioPoint;
  const baseSummary = summarizeWorld(state);
  const summary: WorldSummary = {
    ...baseSummary,
    tick: state.tick + horizonTicks,
    totalPopulation: finalPoint.totalPopulation,
    meanTemperatureC: finalPoint.meanTemperatureC,
    meanPollution: finalPoint.meanPollution,
  };
  const capacityUse =
    summary.totalCarryingCapacity > 0
      ? summary.totalPopulation / summary.totalCarryingCapacity
      : 0;
  const score = round(
    finalPoint.habitability * 0.65 +
      clamp(capacityUse, 0, 1) * 0.25 -
      finalPoint.meanPollution * 0.1,
  );

  return { run, score, summary, trajectory };
}

/**
 * Runs bounded stochastic projections with deterministic per-run seeds.
 * The selected best/worst cases are outcomes, not confidence guarantees.
 */
export function projectFutureScenarios(
  state: WorldState,
  options: FutureProjectionOptions,
): FutureProjection {
  if (
    !Number.isInteger(options.horizonTicks) ||
    options.horizonTicks < 1 ||
    options.horizonTicks > 10_000
  ) {
    throw new RangeError("horizonTicks must be an integer in [1, 10000]");
  }
  const runs = options.runs ?? 101;
  if (!Number.isInteger(runs) || runs < 3 || runs > 10_000) {
    throw new RangeError("runs must be an integer in [3, 10000]");
  }
  const projectionSeed =
    options.seed ??
    `${state.seed}:future:${state.tick}:${options.horizonTicks}:${runs}`;
  const outcomes = Array.from({ length: runs }, (_, run) =>
    runScenario(state, options.horizonTicks, run, projectionSeed),
  ).sort((left, right) => left.score - right.score || left.run - right.run);

  const worst = outcomes[0] as FutureScenario;
  const likely = outcomes[Math.floor(outcomes.length / 2)] as FutureScenario;
  const best = outcomes[outcomes.length - 1] as FutureScenario;

  return FutureProjectionSchema.parse({
    seed: projectionSeed,
    horizonTicks: options.horizonTicks,
    runs,
    likely,
    best,
    worst,
    uncertainty: {
      population: {
        low: round(
          quantile(
            outcomes.map(({ summary }) => summary.totalPopulation),
            0.1,
          ),
        ),
        high: round(
          quantile(
            outcomes.map(({ summary }) => summary.totalPopulation),
            0.9,
          ),
        ),
      },
      meanTemperatureC: {
        low: round(
          quantile(
            outcomes.map(({ summary }) => summary.meanTemperatureC),
            0.1,
          ),
        ),
        high: round(
          quantile(
            outcomes.map(({ summary }) => summary.meanTemperatureC),
            0.9,
          ),
        ),
      },
      meanPollution: {
        low: round(
          quantile(
            outcomes.map(({ summary }) => summary.meanPollution),
            0.1,
          ),
        ),
        high: round(
          quantile(
            outcomes.map(({ summary }) => summary.meanPollution),
            0.9,
          ),
        ),
      },
    },
    assumptions: [
      {
        ar: "السيناريوهات احتمالية مبسّطة وليست تنبؤات",
        en: "Scenarios are simplified probabilistic explorations, not forecasts",
      },
      {
        ar: "لا يتجاوز السكان القدرة الاستيعابية لأي منطقة",
        en: "Population never exceeds any region's carrying capacity",
      },
      {
        ar: "تُستمد العشوائية كلها من بذور قابلة لإعادة الإنتاج",
        en: "All randomness comes from reproducible seeds",
      },
    ],
  });
}
