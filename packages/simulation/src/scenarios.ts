import type { PlanetStats, WorldEvent } from "@kawkab/shared-types";
import { SimulationEngine } from "./engine.js";

/**
 * Monte-Carlo futures: fork the world, give each fork its own rng salt, run it
 * forward, and compare outcome distributions. Nothing here claims certainty —
 * the API reports uncertainty explicitly.
 */
export interface ScenarioRunFacts {
  run: number;
  score: number;
  endStats: PlanetStats;
  biodiversity: number;
  meanPollution: number;
  meanTempShift: number;
  warsFought: number;
  topEvents: Array<Pick<WorldEvent, "type" | "title" | "magnitude" | "tick" | "contributionId">>;
}

export interface HorizonFacts {
  yearsAhead: number;
  yearsPerTick: number;
  ticksRun: number;
  runs: ScenarioRunFacts[];
  scoreP10: number;
  scoreP50: number;
  scoreP90: number;
  /** 0..1: relative spread of outcomes — high means genuinely uncertain */
  uncertainty: number;
  /** metric keys whose variance most separated the runs */
  drivers: string[];
}

export function runScenarioSet(
  engine: SimulationEngine,
  horizonsYears: number[],
  runsPerHorizon = 7,
): HorizonFacts[] {
  const baseWorld = engine.serialize();
  const reports: HorizonFacts[] = [];

  for (const years of horizonsYears) {
    const yearsPerTick = years > 30 ? 10 : 1;
    const ticks = Math.max(1, Math.round(years / yearsPerTick));
    const facts: ScenarioRunFacts[] = [];
    for (let r = 0; r < runsPerHorizon; r++) {
      const fork = SimulationEngine.fromWorld(baseWorld, { yearsPerTick });
      fork.salt = `:scenario:${years}:${r}`;
      const startTemp = fork.getStats().meanTemperature;
      let wars = 0;
      let top: ScenarioRunFacts["topEvents"] = [];
      fork.runTicks(ticks, (delta) => {
        wars += delta.newEvents.filter((e) => e.type === "WAR_STARTED").length;
        for (const ev of delta.newEvents) {
          if (ev.magnitude >= 0.55) {
            top.push({ type: ev.type, title: ev.title, magnitude: ev.magnitude, tick: ev.tick, contributionId: ev.contributionId });
          }
        }
      });
      top = top.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);
      const stats = fork.getStats();
      const biodiversity = stats.species;
      const score =
        stats.civilizations * 8 +
        Math.min(60, stats.totalPopulation / 5000) +
        biodiversity * 0.25 +
        stats.tradeRoutes * 2 -
        stats.activeWars * 6 -
        stats.meanPollution * 120 -
        Math.abs(stats.meanTemperature - startTemp) * 8;
      facts.push({
        run: r,
        score,
        endStats: stats,
        biodiversity,
        meanPollution: stats.meanPollution,
        meanTempShift: stats.meanTemperature - startTemp,
        warsFought: wars,
        topEvents: top,
      });
    }

    facts.sort((a, b) => a.score - b.score);
    const scores = facts.map((f) => f.score);
    const p = (q: number) => scores[Math.min(scores.length - 1, Math.floor(q * scores.length))]!;
    const p10 = p(0.1);
    const p50 = p(0.5);
    const p90 = p(0.9);
    const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
    const uncertainty = Math.min(1, Math.abs(p90 - p10) / Math.max(20, Math.abs(mean)));

    // drivers: which metric varied most across runs
    const varianceOf = (pick: (f: ScenarioRunFacts) => number) => {
      const vals = facts.map(pick);
      const m = vals.reduce((s, x) => s + x, 0) / vals.length;
      return vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length / (Math.abs(m) + 1);
    };
    const metricVars: Array<[string, number]> = [
      ["biodiversity", varianceOf((f) => f.biodiversity)],
      ["pollution", varianceOf((f) => f.meanPollution)],
      ["temperature", varianceOf((f) => f.meanTempShift)],
      ["conflict", varianceOf((f) => f.warsFought)],
      ["population", varianceOf((f) => f.endStats.totalPopulation)],
    ];
    metricVars.sort((a, b) => b[1] - a[1]);
    const drivers = metricVars.slice(0, 2).map(([k]) => k);

    reports.push({
      yearsAhead: years,
      yearsPerTick,
      ticksRun: ticks,
      runs: facts,
      scoreP10: p10,
      scoreP50: p50,
      scoreP90: p90,
      uncertainty,
      drivers,
    });
  }
  return reports;
}
