import { describe, expect, it } from "vitest";
import type { AnalyzedContribution } from "@living-planet/shared-types";
import {
  createInitialState,
  getStateChecksum,
  introduceContribution,
  previewContribution,
  replayEvents,
  rollbackToSnapshot,
  runTick,
} from "./index.js";

const plant: AnalyzedContribution = {
  category: "plant",
  name: "Luminous cedar",
  description: "A large tree that absorbs airborne pollutants and emits light at night.",
  traits: {
    growthRate: 0.3,
    waterNeed: 0.7,
    pollutionAbsorption: 0.95,
    adaptability: 0.42,
  },
  possibleBiomes: ["temperate_forest", "tropical_forest"],
  risks: ["high_water_consumption", "ecosystem_competition"],
  balance: { score: 0.78, adjusted: false, adjustments: [] },
  provider: "test",
  sandbox: true,
};

describe("deterministic event-sourced simulation", () => {
  it("produces the same history from the same seed", () => {
    const first = runTick(createInitialState("repeatable"));
    const second = runTick(createInitialState("repeatable"));
    expect(first.events).toEqual(second.events);
    expect(getStateChecksum(first.state)).toBe(getStateChecksum(second.state));
  });

  it("replays events to exactly the same world state", () => {
    const initial = createInitialState("event-replay");
    const advanced = runTick(initial);
    const replayed = replayEvents(initial, advanced.events);
    expect(getStateChecksum(replayed)).toBe(getStateChecksum(advanced.state));
  });

  it("requires a cause for every event", () => {
    const result = runTick(createInitialState("causal"));
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.every((event) => event.cause.length > 10)).toBe(true);
  });

  it("never exceeds regional carrying capacity", () => {
    let state = createInitialState("capacity");
    for (let tick = 0; tick < 20; tick += 1) state = runTick(state).state;
    for (const region of Object.values(state.regions)) {
      expect(region.population).toBeLessThanOrEqual(region.carryingCapacity);
      expect(region.population).toBeGreaterThanOrEqual(0);
    }
  });

  it("rolls back to a deterministic snapshot", () => {
    let state = createInitialState("rollback");
    for (let tick = 0; tick < 12; tick += 1) state = runTick(state).state;
    const checksumAtTen = state.snapshots.find((snapshot) => snapshot.tick === 10)?.checksum;
    const rolledBack = rollbackToSnapshot(state, 10);
    expect(rolledBack.tick).toBe(10);
    expect(getStateChecksum(rolledBack)).toBe(checksumAtTen);
  });

  it("builds bounded Monte Carlo scenarios and applies contributions as events", () => {
    const state = createInitialState("contribution");
    const region = Object.values(state.regions).find((candidate) => candidate.biome === "temperate_forest")
      ?? Object.values(state.regions)[0];
    expect(region).toBeDefined();
    const preview = previewContribution(state, plant, region!.id, 32);
    expect(preview.successProbability).toBeGreaterThanOrEqual(0);
    expect(preview.successProbability).toBeLessThanOrEqual(1);
    expect(preview.longTerm.confidence).toBeLessThan(preview.shortTerm.confidence);
    const result = introduceContribution(state, plant, region!.id, "contribution-1");
    expect(result.events[0]?.cause).toContain("habitat suitability");
    expect(result.state.events).toHaveLength(1);
  });
});
