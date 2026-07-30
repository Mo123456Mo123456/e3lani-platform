/**
 * Monte Carlo future scenarios — "what happens after your addition?".
 *
 * N branch worlds fork from the current snapshot. Each branch perturbs only
 * its future random stream (never the past), then runs the horizon. Branches
 * are scored on contribution viability, world stability and impact; the
 * report surfaces the most-likely / best / worst branch plus an uncertainty
 * metric and the decisive factors separating good from bad outcomes.
 *
 * Fully deterministic for a given engine state + parameters.
 */
import type { ScenarioOutcome, ScenarioReport, WorldEvent } from "@planet/shared-types";
import { SimulationEngine } from "./engine";
import { contributionViability } from "../contributions/apply";

export interface ScenarioOptions {
  horizonTicks: number;
  runs: number;
  /** focus scoring on this contribution when provided */
  contributionId?: string;
}

export function runScenarios(
  engine: SimulationEngine,
  options: ScenarioOptions,
): ScenarioReport {
  const runs = Math.max(3, Math.min(64, options.runs));
  const horizon = Math.max(1, Math.min(2000, options.horizonTicks));
  const base = engine.getSnapshot(engine.state.tick);
  if (!base) throw new Error("no snapshot available for scenario analysis");

  const outcomes: ScenarioOutcome[] = [];
  for (let i = 0; i < runs; i++) {
    const branchState = structuredClone(base);
    // perturb ONLY the future: the tick rng derives from state.seed
    branchState.seed = `${base.seed}%mc${i}`;
    const branch = SimulationEngine.fromSnapshot(engine.config, branchState, []);
    const events = branch.run(horizon);
    outcomes.push(scoreBranch(branch, events, i, options.contributionId));
  }

  const sorted = [...outcomes].sort((a, b) => b.score - a.score);
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;
  const median = sorted[Math.floor(sorted.length / 2)]!;

  const mean = outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length;
  const variance = outcomes.reduce((s, o) => s + (o.score - mean) ** 2, 0) / outcomes.length;
  const typeDivergence = eventTypeDivergence(outcomes);
  const uncertainty = Math.min(1, Math.sqrt(variance) * 2 + typeDivergence * 0.5);

  return {
    mostLikely: median,
    best,
    worst,
    uncertainty: Math.round(uncertainty * 1000) / 1000,
    decisiveFactors: decisiveFactors(outcomes),
    runs,
    horizonTicks: horizon,
  };
}

function scoreBranch(
  branch: SimulationEngine,
  events: WorldEvent[],
  runIndex: number,
  contributionId?: string,
): ScenarioOutcome {
  const state = branch.state;
  const livingCivs = state.civs.filter((c) => c.collapsedAtTick === null);
  const stability =
    livingCivs.length > 0
      ? livingCivs.reduce((s, c) => s + c.stability, 0) / livingCivs.length
      : 0.2;

  const relevant = contributionId
    ? events.filter((e) => e.originContributionId === contributionId)
    : events;
  const viability = contributionId
    ? contributionViability(state, contributionId)
    : 0.5;
  const impact = Math.min(1, relevant.length / 20);

  const keyEvents = relevant
    .filter((e) => e.importance >= 0.5)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 12);

  const score = Math.round((viability * 0.4 + stability * 0.3 + impact * 0.3) * 1000) / 1000;
  return {
    runIndex,
    score,
    survivalOfContribution: contributionId ? viability > 0.15 : true,
    keyEvents,
    endState: {
      stability: Math.round(stability * 1000) / 1000,
      civilizations: livingCivs.length,
      species: state.species.filter((s) => !s.extinctAtTick).length,
      wars: state.wars.filter((w) => !w.endedAtTick).length,
      viability: Math.round(viability * 1000) / 1000,
    },
  };
}

/** 0..1 — how much do the branches disagree on what happens? */
function eventTypeDivergence(outcomes: ScenarioOutcome[]): number {
  const signatures = new Set(
    outcomes.map((o) => [...new Set(o.keyEvents.map((e) => e.type))].sort().join("|")),
  );
  return Math.min(1, (signatures.size - 1) / Math.max(1, outcomes.length - 1) + 0.2);
}

/** event types that best separate the top quartile from the bottom one */
function decisiveFactors(outcomes: ScenarioOutcome[]): string[] {
  const sorted = [...outcomes].sort((a, b) => b.score - a.score);
  const q = Math.max(1, Math.floor(sorted.length / 4));
  const top = sorted.slice(0, q);
  const bottom = sorted.slice(-q);
  const count = (runs: ScenarioOutcome[], type: string): number =>
    runs.filter((r) => r.keyEvents.some((e) => e.type === type)).length;
  const types = new Set<string>();
  for (const run of outcomes) for (const e of run.keyEvents) types.add(e.type);
  const scored = [...types].map((type) => ({
    type,
    separation: count(top, type) / top.length - count(bottom, type) / bottom.length,
  }));
  return scored
    .sort((a, b) => Math.abs(b.separation) - Math.abs(a.separation))
    .slice(0, 4)
    .map((s) => s.type);
}
