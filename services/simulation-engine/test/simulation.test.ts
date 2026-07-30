import { describe, expect, it } from "vitest";
import { checksum } from "@kawkab/simulation-models";
import type { UserContribution } from "@kawkab/shared-types";
import { applyContribution, canFoundCivilization, createInitialState, createRichDemoState, replayEvents, runFutureScenarios, runTicks } from "../src/index";

describe("deterministic simulation core", () => {
  it("same seed produces same history", () => {
    const a = runTicks({ seed: "same-seed", resolution: 10 }, 8);
    const b = runTicks({ seed: "same-seed", resolution: 10 }, 8);
    expect(checksum(a.events)).toEqual(checksum(b.events));
  });

  it("event replay restores state", () => {
    const state = runTicks({ seed: "replay-seed", resolution: 10 }, 6);
    const replayed = replayEvents({ seed: "replay-seed", resolution: 10 }, state.events);
    expect(checksum({ species: replayed.species, civilizations: replayed.civilizations, cities: replayed.cities, tick: replayed.tick })).toEqual(
      checksum({ species: state.species, civilizations: state.civilizations, cities: state.cities, tick: state.tick })
    );
  });

  it("does not found civilization without resources and population", () => {
    const state = createInitialState({ seed: "poor-world", resolution: 8 });
    const region = state.planet.regions[0]!;
    for (const species of Object.values(state.species)) species.population = 0;
    for (const key of Object.keys(state.resources)) delete state.resources[key];
    expect(canFoundCivilization(state, region.id)).toBe(false);
  });

  it("keeps population under carrying capacity", () => {
    const state = runTicks({ seed: "capacity-seed", resolution: 12 }, 20);
    for (const species of Object.values(state.species)) {
      expect(species.population).toBeLessThanOrEqual(species.carryingCapacity);
    }
  });

  it("applyContribution produces caused events", () => {
    const state = createRichDemoState("contribution-seed", 14, 2);
    const contribution: UserContribution = {
      id: "contrib-1",
      userId: "user-1",
      planetId: state.planet.id,
      category: "plant",
      prompt: "نبات يرمم التلوث",
      structuredPayload: { name: "نبات يرمم التلوث", targetRegionId: state.planet.regions.find((region) => region.biome !== "deep_ocean")?.id },
      status: "previewed",
      balanceNotes: [],
      previewEventIds: [],
      confirmedEventIds: [],
      createdAt: new Date(0).toISOString()
    };
    const result = applyContribution(state, contribution);
    expect(result.events.length).toBeGreaterThanOrEqual(2);
    expect(result.events.every((event) => event.causeEventIds.length > 0)).toBe(true);
    expect(result.events.some((event) => event.type === "CONTRIBUTION_APPLIED")).toBe(true);
  });

  it("Monte Carlo futures return uncertainty", () => {
    const state = createRichDemoState("scenario-seed", 14, 2);
    const scenarios = runFutureScenarios(state, 5, 4);
    expect(scenarios.scenarios).toHaveLength(4);
    expect(scenarios.uncertainty).toBeGreaterThanOrEqual(0);
    expect(scenarios.best.score).toBeGreaterThanOrEqual(scenarios.worst.score);
  });

  it("rich demo supports multiple civilizations", () => {
    const state = createRichDemoState("multi-civ-seed", 14, 1);
    expect(Object.keys(state.civilizations).length).toBeGreaterThanOrEqual(12);
  });

  it("climate mutates region values", () => {
    const state = createInitialState({ seed: "climate-seed", resolution: 10 });
    const before = checksum(state.planet.regions.map((region) => [region.id, region.temperature, region.moisture, region.pollution]));
    const after = runTicks({ seed: "climate-seed", resolution: 10 }, 3);
    const afterChecksum = checksum(after.planet.regions.map((region) => [region.id, region.temperature, region.moisture, region.pollution]));
    expect(afterChecksum).not.toEqual(before);
  });
});
