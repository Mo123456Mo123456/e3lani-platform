import type {
  CommitContributionRequest,
  ContributionAnalysis,
} from "@planet/shared-types";
import { describe, expect, it } from "vitest";

import {
  addContribution,
  advanceWorld,
  generateWorld,
  hashWorld,
  replayWorld,
  restoreSnapshot,
  snapshotWorld,
} from "../src";

const analysis: ContributionAnalysis = {
  category: "plant",
  name: "شجرة الضوء العملاقة",
  description: "شجرة تمتص جزءًا من التلوث وتضيء ليلًا.",
  traits: {
    size: 0.9,
    growthRate: 0.3,
    waterNeed: 0.7,
    pollutionAbsorption: 0.95,
    nightLuminosity: 0.8,
    coldResistance: 0.4,
    heatResistance: 0.7,
    aggression: 0,
    intelligence: 0,
    adaptability: 0.55,
    energyYield: 0.2,
    contagion: 0,
  },
  possibleBiomes: ["rainforest", "temperate_forest", "wetland"],
  risks: ["high_water_consumption", "ecosystem_competition"],
  benefits: ["pollution_absorption", "renewable_light"],
  balanceScore: 0.78,
  moderation: { accepted: true, reasons: [], adjusted: false },
  provider: "mock",
  sandbox: true,
};

describe("deterministic simulation", () => {
  it("generates identical worlds for the same seed", () => {
    const first = generateWorld({ seed: "nova-terra-v1", regionCount: 128 });
    const second = generateWorld({ seed: "nova-terra-v1", regionCount: 128 });

    expect(hashWorld(first)).toBe(hashWorld(second));
    expect(first.regions).toEqual(second.regions);
  });

  it("generates a different world for another seed", () => {
    const first = generateWorld({ seed: "nova-terra-v1", regionCount: 128 });
    const second = generateWorld({ seed: "nova-terra-v2", regionCount: 128 });

    expect(hashWorld(first)).not.toBe(hashWorld(second));
  });

  it("replays the event stream to exactly the same state", () => {
    const initial = generateWorld({ seed: "replay-test", regionCount: 128 });
    const region = initial.regions.find(
      ({ biome }) => biome === "temperate_forest",
    ) ?? initial.regions.find(({ biome }) => biome !== "ocean")!;
    const request: CommitContributionRequest = {
      analysis,
      regionId: region.id,
      idempotencyKey: "contribution-replay-test-001",
    };
    const committed = addContribution(initial, "sandbox-user", request);
    const advanced = advanceWorld(committed.world, 50);
    const replayed = replayWorld(initial, advanced.world.events);

    expect(hashWorld(replayed)).toBe(hashWorld(advanced.world));
  });

  it("restores only snapshots that pass their integrity hash", () => {
    const world = advanceWorld(
      generateWorld({ seed: "snapshot-test", regionCount: 96 }),
      5,
    ).world;
    const snapshot = snapshotWorld(world);

    expect(hashWorld(restoreSnapshot(snapshot))).toBe(hashWorld(world));
    snapshot.state.currentYear += 1;
    expect(() => restoreSnapshot(snapshot)).toThrow(
      "Snapshot integrity check failed",
    );
  });

  it("never emits an event without an explicit cause", () => {
    const world = advanceWorld(
      generateWorld({ seed: "causality-test", regionCount: 96 }),
      200,
    ).world;

    expect(world.events.length).toBeGreaterThan(1);
    expect(world.events.every(({ cause }) => cause.trim().length > 0)).toBe(
      true,
    );
  });

  it("places civilizations only in inhabited land regions", () => {
    const world = generateWorld({ seed: "civilization-test", regionCount: 128 });
    const regionById = new Map(world.regions.map((region) => [region.id, region]));
    const civilizations = world.entities.filter(
      ({ kind }) => kind === "civilization",
    );

    expect(civilizations).toHaveLength(12);
    expect(
      civilizations.every((civilization) => {
        const region = regionById.get(civilization.regionId);
        return (
          civilization.population > 0 &&
          region !== undefined &&
          region.biome !== "ocean" &&
          region.biome !== "ice"
        );
      }),
    ).toBe(true);
  });
});
