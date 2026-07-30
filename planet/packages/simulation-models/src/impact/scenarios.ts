import type {
  AnalyzedContribution,
  ContributionPreview,
  ScenarioHorizon,
  ScenarioSummary,
} from "@planet/shared-types";
import { WorldEventType } from "@planet/shared-types";
import { takeSnapshot, restoreSnapshot } from "../engine/snapshot.js";
import { runTicks } from "../engine/tick.js";
import { speciesPopulation, type WorldState } from "../engine/types.js";
import { applyContribution, placementSuccess, quickImpactEstimate } from "./contribution.js";
import { clamp01 } from "../math.js";
import { BIOME_ORDER } from "../planet/types.js";

interface RunResult {
  score: number;
  summary: ScenarioSummary;
  eventCounts: Map<string, number>;
}

/**
 * Monte-Carlo futures: clone the world, apply the contribution, then run N
 * seeded branches per horizon. Because every branch derives from
 * (worldSeed, contributionId, horizon, runIndex), the whole preview is
 * reproducible — and always presented as probabilities, never certainties.
 */
export function runFutureScenarios(
  world: WorldState,
  contributionId: string,
  analysis: AnalyzedContribution,
  cellIndex: number,
  opts: { horizons?: number[]; runsPerHorizon?: number } = {},
): ContributionPreview {
  const horizons = opts.horizons ?? [1, 10, 100, 1000];
  const runs = opts.runsPerHorizon ?? 6;
  const results: ScenarioHorizon[] = [];

  for (const years of horizons) {
    const ticks = Math.max(1, Math.round(years / world.yearsPerTick));
    const branchResults: RunResult[] = [];
    for (let r = 0; r < runs; r++) {
      const branch = restoreSnapshot(takeSnapshot(world));
      // Each branch gets its own deterministic stream offset.
      branch.rng.seed = branch.rng.seed ^ (r * 0x9e3779b9 + years * 0x85ebca6b);
      const applied = applyContribution(branch, `${contributionId}#sim${r}`, analysis, cellIndex);
      if (!applied.ok) {
        branchResults.push(emptyRun());
        continue;
      }
      const events = runTicks(branch, Math.min(ticks, 300));
      branchResults.push(scoreRun(branch, events));
    }
    results.push(aggregateHorizon(years, branchResults));
  }

  const impact = quickImpactEstimate(world, analysis);
  const success = placementSuccess(world, analysis, cellIndex);
  const biome = BIOME_ORDER[world.grid.biome[cellIndex] ?? 0];
  const beneficiaryCivs = world.civs
    .filter((c) => !c.fallen && Math.abs(c.capitalCell - cellIndex) < world.grid.width * 3)
    .slice(0, 3)
    .map((c) => c.name);

  return {
    successProbability: success,
    suitableBiomes: analysis.possibleBiomes,
    environmentalImpact: impact.environmental,
    economicImpact: impact.economic,
    risks: analysis.risks,
    beneficiaryCivs,
    horizons: results,
  };
  void biome;
}

function emptyRun(): RunResult {
  return {
    score: 0,
    summary: { biosphereHealth: 0, civProsperity: 0, pollution: 1, population: 0, notableEvents: [] },
    eventCounts: new Map(),
  };
}

function scoreRun(world: WorldState, events: { type: WorldEventType }[]): RunResult {
  let floraPop = 0;
  let floraCount = 0;
  let faunaPop = 0;
  for (const s of world.species) {
    if (s.extinct) continue;
    if (s.kind === "flora") {
      floraPop += speciesPopulation(s);
      floraCount++;
    } else {
      faunaPop += speciesPopulation(s);
    }
  }
  const livingCivs = world.civs.filter((c) => !c.fallen);
  const totalPop = livingCivs.reduce((sum, c) => sum + c.population, 0);
  const avgStability = livingCivs.reduce((sum, c) => sum + c.stability, 0) / Math.max(livingCivs.length, 1);
  const avgTech = livingCivs.reduce((sum, c) => sum + c.techLevel, 0) / Math.max(livingCivs.length, 1);

  let pollutionSum = 0;
  for (let i = 0; i < world.grid.cellCount; i++) pollutionSum += world.grid.pollution[i] ?? 0;
  const pollution = clamp01(pollutionSum / world.grid.cellCount);

  const biosphereHealth = clamp01(
    (floraCount / 400) * 0.4 + clamp01(floraPop / 20000) * 0.3 + clamp01(faunaPop / 8000) * 0.3,
  );
  const civProsperity = clamp01(avgStability * 0.5 + (avgTech / 50) * 0.3 + clamp01(totalPop / 60000) * 0.2);

  const eventCounts = new Map<string, number>();
  for (const e of events) {
    eventCounts.set(e.type, (eventCounts.get(e.type) ?? 0) + 1);
  }
  const notableEvents = [...eventCounts.entries()]
    .filter(([type]) => type !== WorldEventType.PlantSpread)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const wars = eventCounts.get(WorldEventType.WarStarted) ?? 0;
  const extinctions = eventCounts.get(WorldEventType.SpeciesExtinct) ?? 0;
  const score =
    biosphereHealth * 0.35 + civProsperity * 0.35 + (1 - pollution) * 0.2 -
    Math.min(wars * 0.02, 0.1) - Math.min(extinctions * 0.005, 0.05);

  return {
    score,
    summary: {
      biosphereHealth,
      civProsperity,
      pollution,
      population: totalPop,
      notableEvents,
    },
    eventCounts,
  };
}

function aggregateHorizon(years: number, runs: RunResult[]): ScenarioHorizon {
  const sorted = [...runs].sort((a, b) => b.score - a.score);
  const best = sorted[0]?.summary ?? emptyRun().summary;
  const worst = sorted[sorted.length - 1]?.summary ?? emptyRun().summary;

  // Median branch = "most likely".
  const median = sorted[Math.floor(sorted.length / 2)]?.summary ?? emptyRun().summary;

  // Uncertainty = normalized spread of branch scores.
  const scores = sorted.map((r) => r.score);
  const mean = scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1);
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(scores.length, 1);
  const uncertainty = clamp01(Math.sqrt(variance) * 3);

  // Likelihood: how concentrated outcomes are (high spread = low likelihood).
  const likelihood = clamp01(1 - uncertainty);

  const keyFactors: string[] = [];
  const wars = runs.reduce((s, r) => s + (r.eventCounts.get(WorldEventType.WarStarted) ?? 0), 0);
  const extinctions = runs.reduce((s, r) => s + (r.eventCounts.get(WorldEventType.SpeciesExtinct) ?? 0), 0);
  const techs = runs.reduce((s, r) => s + (r.eventCounts.get(WorldEventType.TechnologyDiscovered) ?? 0), 0);
  if (wars > runs.length) keyFactors.push("conflict_escalation");
  if (extinctions > runs.length) keyFactors.push("ecological_pressure");
  if (techs > runs.length * 2) keyFactors.push("technological_acceleration");
  if (best.pollution > 0.3) keyFactors.push("pollution_burden");
  if (keyFactors.length === 0) keyFactors.push("stable_conditions");

  return {
    years,
    likelihood,
    uncertainty,
    summary: median,
    best,
    worst,
    keyFactors,
  };
}
