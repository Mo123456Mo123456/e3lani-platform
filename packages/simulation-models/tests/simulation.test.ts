import { describe, expect, it } from "vitest";
import {
  applyContribution,
  forecastContribution,
  generateWorld,
  replayEvents,
  simulateTick,
} from "../src/index.js";

describe("deterministic world simulation", () => {
  it("generates identical worlds and histories from the same seed", () => {
    const first = generateWorld({ seed: "gaia-ar-01", width: 16, height: 8 });
    const second = generateWorld({ seed: "gaia-ar-01", width: 16, height: 8 });
    expect(second).toEqual(first);
    expect(simulateTick(second)).toEqual(simulateTick(first));
  });

  it("replays tick events to the same state", () => {
    const initial = generateWorld({ seed: "replay-01", width: 16, height: 8 });
    const result = simulateTick(initial);
    expect(replayEvents(initial, result.events)).toEqual(result.state);
  });

  it("keeps civilization population within regional carrying capacity", () => {
    let state = generateWorld({ seed: "capacity-01", width: 16, height: 8 });
    for (let index = 0; index < 20; index += 1)
      state = simulateTick(state).state;
    for (const civilization of state.civilizations) {
      const region = state.regions.find(
        (item) => item.id === civilization.regionId,
      )!;
      const capacity =
        (region.fertility * 1_500_000 + region.resources.water! * 600_000) *
        (0.7 + civilization.technology);
      expect(civilization.population).toBeLessThanOrEqual(capacity);
    }
  });

  it("records explicit causes and produces probabilistic forecasts", () => {
    const initial = generateWorld({ seed: "cause-01", width: 16, height: 8 });
    const region =
      initial.regions.find((item) => item.biome === "temperate_forest") ??
      initial.regions.find((item) => item.biome !== "ocean")!;
    const analysis = {
      category: "plant" as const,
      name: "شجرة الضوء",
      description: "شجرة تمتص التلوث وتخزن الطاقة الشمسية",
      traits: { growthRate: 0.3, waterNeed: 0.7, pollutionAbsorption: 0.9 },
      possibleBiomes: ["temperate_forest" as const],
      risks: ["high_water_consumption"],
      balancedChanges: [],
      provider: "sandbox-rule-engine" as const,
      model: "rules-v1",
    };
    const applied = applyContribution(
      initial,
      "contribution-1",
      analysis,
      region.id,
    );
    expect(applied.events.every((event) => event.cause.length > 0)).toBe(true);
    expect(forecastContribution(initial, analysis, region, 16)).toHaveLength(4);
  });
});
