import { describe, expect, it } from "vitest";
import { SimulationEngine } from "./engine.js";
import { runScenarioSet } from "./scenarios.js";

const SMALL = { gridWidth: 48, gridHeight: 24, snapshotInterval: 50 };

describe("monte-carlo futures", () => {
  it("produces distributions with honest uncertainty, not certainties", () => {
    const e = SimulationEngine.create("seed-scenarios", SMALL);
    e.runTicks(10);
    const reports = runScenarioSet(e, [10, 100], 5);
    expect(reports.length).toBe(2);
    for (const r of reports) {
      expect(r.runs.length).toBe(5);
      expect(r.scoreP10).toBeLessThanOrEqual(r.scoreP50);
      expect(r.scoreP50).toBeLessThanOrEqual(r.scoreP90);
      expect(r.uncertainty).toBeGreaterThanOrEqual(0);
      expect(r.uncertainty).toBeLessThanOrEqual(1);
      expect(r.drivers.length).toBeGreaterThan(0);
    }
  }, 180_000);

  it("scenario runs are deterministic per (seed, horizon, run)", () => {
    const e1 = SimulationEngine.create("seed-sc-det", SMALL);
    const e2 = SimulationEngine.create("seed-sc-det", SMALL);
    const a = runScenarioSet(e1, [10], 3);
    const b = runScenarioSet(e2, [10], 3);
    expect(a[0]!.scoreP50).toBe(b[0]!.scoreP50);
  }, 180_000);
});
