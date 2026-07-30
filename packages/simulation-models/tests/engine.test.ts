import { describe, expect, it } from "vitest";
import {
  applyContribution,
  createInitialWorld,
  generateWorld,
  replayFromSnapshot,
  serializeWorldState,
  stepSimulation,
} from "../src/index.js";

describe("deterministic world generation", () => {
  it("same seed produces identical cells", () => {
    const a = generateWorld("test-seed-1", 32, 16);
    const b = generateWorld("test-seed-1", 32, 16);
    expect(a.cells).toEqual(b.cells);
  });

  it("different seeds diverge", () => {
    const a = generateWorld("seed-a", 32, 16);
    const b = generateWorld("seed-b", 32, 16);
    expect(a.cells[10]).not.toEqual(b.cells[10]);
  });
});

const smallWorld = (seed: string) =>
  createInitialWorld(seed, {
    speciesCount: 20,
    plantCount: 20,
    resourceCount: 20,
    cityCount: 12,
    technologyCount: 10,
    bootstrapTicks: 0,
  });

describe("simulation determinism", () => {
  it("same seed history replays identically", () => {
    const w1 = smallWorld("replay-seed");
    const w2 = smallWorld("replay-seed");
    const a = stepSimulation(w1, 25);
    const b = stepSimulation(w2, 25);
    expect(serializeWorldState(a)).toEqual(serializeWorldState(b));
  });

  it("replayFromSnapshot matches continuous run", () => {
    const base = smallWorld("snap-seed");
    const continuous = stepSimulation(base, 10);
    const replayed = replayFromSnapshot(base, 10);
    expect(serializeWorldState(continuous)).toEqual(serializeWorldState(replayed));
  });
});

describe("contribution causality", () => {
  it("plant contribution creates grounded events", () => {
    const world = smallWorld("contrib-seed");
    const result = applyContribution(
      world,
      {
        category: "plant",
        name: "شجرة الضوء",
        traits: {
          pollutionAbsorption: 0.9,
          growthRate: 0.4,
          waterNeed: 0.6,
        },
        possibleBiomes: ["temperate_forest", "rainforest"],
        risks: [],
        benefits: ["pollution_reduction"],
        wasBalanced: false,
        balanceNotes: [],
      },
      { lat: 10, lon: 20 },
      "00000000-0000-4000-a000-000000000001",
    );
    expect(result.rootEventId).toBeTruthy();
    expect(result.state.events.some((e) => e.type === "USER_CONTRIBUTION_APPLIED")).toBe(true);
    expect(result.state.plants.some((p) => p.name === "شجرة الضوء")).toBe(true);
    const effects = result.state.causal.effectsFrom(result.rootEventId);
    expect(effects.length).toBeGreaterThan(0);
  });

  it("rejects unlimited reproduction via balance", () => {
    const world = smallWorld("balance-seed");
    const result = applyContribution(
      world,
      {
        category: "creature",
        name: "وحش خالد",
        traits: {
          immortality: 1,
          reproductionRate: 0.99,
          unlimitedEnergy: 1,
        },
        possibleBiomes: ["plains"],
        risks: [],
        benefits: [],
        wasBalanced: false,
        balanceNotes: [],
      },
      { lat: 0, lon: 0 },
    );
    const applied = result.state.events.find((e) => e.type === "USER_CONTRIBUTION_APPLIED");
    const effects = applied?.directEffects as {
      wasBalanced?: boolean;
      traits?: Record<string, number>;
    };
    expect(effects.wasBalanced).toBe(true);
    expect(effects.traits?.reproductionRate ?? 1).toBeLessThanOrEqual(0.7);
  });
});

describe("invariants", () => {
  it("civilizations always have population and regions", () => {
    let world = smallWorld("inv-seed");
    world = stepSimulation(world, 30);
    for (const civ of world.civilizations) {
      expect(civ.population).toBeGreaterThan(0);
      expect(civ.regionIds.length).toBeGreaterThan(0);
    }
  });

  it("events always have types and importance", () => {
    let world = smallWorld("evt-seed");
    world = stepSimulation(world, 15);
    for (const e of world.events) {
      expect(e.type).toBeTruthy();
      expect(e.importance).toBeGreaterThanOrEqual(0);
      expect(e.importance).toBeLessThanOrEqual(1);
    }
  });

  it("demo seed density matches targets", () => {
    const world = createInitialWorld("density-check", { bootstrapTicks: 0 });
    expect(world.civilizations).toHaveLength(12);
    expect(world.cities).toHaveLength(40);
    expect(world.resources).toHaveLength(120);
    expect(world.species).toHaveLength(300);
    expect(world.plants).toHaveLength(800);
    expect(world.technologies).toHaveLength(50);
  });
});
