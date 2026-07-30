import type { FutureScenario, StructuredContribution } from "@planet/shared-types";
import { applyContribution } from "./contribution.js";
import { SeededRandom } from "./rng.js";
import { advanceTick } from "./tick-engine.js";
import type { WorldState } from "./world-state.js";
import { cloneWorld, worldMetrics } from "./world-state.js";

export interface ScenarioRunOptions {
  contribution: StructuredContribution;
  regionId: string;
  userId: string;
  contributionId: string;
  horizons?: number[];
  samples?: number;
}

export function runFutureScenarios(
  base: WorldState,
  opts: ScenarioRunOptions,
): FutureScenario[] {
  const horizons = opts.horizons ?? [1, 10, 100, 1000];
  const samples = opts.samples ?? 6;
  const scenarios: FutureScenario[] = [];

  for (const years of horizons) {
    const results: Array<{ metrics: ReturnType<typeof worldMetrics>; score: number }> = [];
    for (let i = 0; i < samples; i++) {
      const branch = cloneWorld(base);
      // Salt RNG for Monte Carlo branch
      branch.rngState ^= new SeededRandom(base.seed + years * 1000 + i).int(1, 1e9);
      const applied = applyContribution(
        branch,
        opts.contribution,
        opts.regionId,
        opts.userId,
        `${opts.contributionId}_mc_${years}_${i}`,
      );
      const ticks = Math.max(1, Math.min(years, 80)); // cap compute
      const advanced = advanceTick(applied.state, ticks);
      const metrics = advanced.metrics;
      const score =
        metrics.globalStability * 0.4 +
        (1 - metrics.globalPollution) * 0.3 +
        Math.min(1, metrics.population / 20_000_000) * 0.3;
      results.push({ metrics, score });
    }

    results.sort((a, b) => b.score - a.score);
    const best = results[0]!;
    const worst = results[results.length - 1]!;
    const mid = results[Math.floor(results.length / 2)]!;
    const mean = results.reduce((s, r) => s + r.score, 0) / results.length;
    const variance =
      results.reduce((s, r) => s + (r.score - mean) ** 2, 0) / results.length;

    scenarios.push(
      scenarioFrom("most_likely", years, mid, 0.5, variance),
      scenarioFrom("best", years, best, 0.2, variance),
      scenarioFrom("worst", years, worst, 0.2, variance),
    );
  }

  return scenarios;
}

function scenarioFrom(
  label: FutureScenario["label"],
  years: number,
  result: { metrics: ReturnType<typeof worldMetrics>; score: number },
  probability: number,
  variance: number,
): FutureScenario {
  const m = result.metrics;
  const uncertainty = Math.min(0.9, Math.sqrt(variance) * 2 + (years > 100 ? 0.2 : 0));
  return {
    horizonYears: years,
    label,
    probability: Math.round((probability * (1 - uncertainty * 0.3)) * 100) / 100,
    summary: `After ${years} years: stability ${pct(m.globalStability)}, pollution ${pct(m.globalPollution)}, wars ${m.activeWars}. Uncertainty ${pct(uncertainty)}.`,
    summaryAr: `بعد ${years} سنة: الاستقرار ${pct(m.globalStability)}، التلوث ${pct(m.globalPollution)}، الحروب ${m.activeWars}. عدم اليقين ${pct(uncertainty)}.`,
    keyFactors: [
      "contribution_traits",
      "regional_climate",
      "civilization_response",
      ...(years >= 100 ? ["long_horizon_variance"] : []),
    ],
    metrics: {
      stability: m.globalStability,
      pollution: m.globalPollution,
      population: m.population,
      activeWars: m.activeWars,
      uncertainty,
      score: result.score,
    },
  };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
