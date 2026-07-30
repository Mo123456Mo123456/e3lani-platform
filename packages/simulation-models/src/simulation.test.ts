import { describe, expect, it } from "vitest";
import { applyContribution, balanceContribution } from "./contribution.js";
import { hashWorld } from "./hash.js";
import { shortestPath } from "./pathfinding.js";
import { advanceTick } from "./tick-engine.js";
import { GENERATOR_TARGETS, generateWorld } from "./world-generator.js";

describe("deterministic world generation", () => {
  it("same seed produces identical worlds", () => {
    const a = generateWorld({ planetId: "p1", seed: 42424242, full: false });
    const b = generateWorld({ planetId: "p1", seed: 42424242, full: false });
    expect(hashWorld(a)).toBe(hashWorld(b));
    expect(a.regions.map((r) => r.biome)).toEqual(b.regions.map((r) => r.biome));
    expect(a.civilizations.map((c) => c.name)).toEqual(b.civilizations.map((c) => c.name));
  });

  it("full seed meets demo entity targets", () => {
    const w = generateWorld({ planetId: "p1", seed: 7, full: true });
    expect(w.civilizations.length).toBe(GENERATOR_TARGETS.civilizations);
    expect(w.cities.length).toBe(GENERATOR_TARGETS.cities);
    expect(w.resources.length).toBe(GENERATOR_TARGETS.resources);
    expect(w.species.length).toBe(GENERATOR_TARGETS.species);
    expect(w.plants.length).toBe(GENERATOR_TARGETS.plants);
    expect(w.technologies.length).toBe(GENERATOR_TARGETS.technologies);
  });
});

describe("tick engine", () => {
  it("replaying the same ticks yields identical state", () => {
    const base = generateWorld({ planetId: "p1", seed: 99, full: false });
    const r1 = advanceTick(base, 5);
    const r2 = advanceTick(base, 5);
    expect(hashWorld(r1.state)).toBe(hashWorld(r2.state));
  });

  it("events always have causes", () => {
    const base = generateWorld({ planetId: "p1", seed: 123, full: false });
    const { newEvents } = advanceTick(base, 10);
    for (const e of newEvents) {
      if (e.type === "TICK_COMPLETED") continue;
      expect(e.causes.length).toBeGreaterThan(0);
    }
  });

  it("civilizations require population", () => {
    const w = generateWorld({ planetId: "p1", seed: 1, full: false });
    for (const c of w.civilizations) {
      expect(c.population).toBeGreaterThan(0);
      expect(c.regionIds.length).toBeGreaterThan(0);
    }
  });
});

describe("contributions", () => {
  it("balances overpowered traits", () => {
    const balanced = balanceContribution({
      category: "plant",
      name: "God Tree",
      nameAr: "شجرة إلهية",
      description: "x",
      descriptionAr: "س",
      traits: { growthRate: 5, energyOutput: 9, pollutionAbsorption: 2 },
      possibleBiomes: ["rainforest"],
      risks: [],
      benefits: [],
      balanceNotes: [],
      wasBalanced: false,
      originalIdea: "شجرة لا تموت وتنتج طاقة لا نهائية",
    });
    expect(balanced.wasBalanced).toBe(true);
    expect(balanced.traits.growthRate!).toBeLessThanOrEqual(0.85);
    expect(balanced.traits.energyOutput!).toBeLessThanOrEqual(0.85);
  });

  it("applies plant contribution and creates causal event", () => {
    const w = generateWorld({ planetId: "p1", seed: 42, full: false });
    const land = w.regions.find((r) => r.biome === "temperate_forest" || r.biome === "plains")!;
    const result = applyContribution(
      w,
      {
        category: "plant",
        name: "Light Tree",
        nameAr: "شجرة الضوء",
        description: "Absorbs pollution",
        descriptionAr: "تمتص التلوث",
        traits: { pollutionAbsorption: 0.9, waterNeed: 0.7, growthRate: 0.3, nightLuminosity: 0.8 },
        possibleBiomes: ["temperate_forest", "rainforest"],
        risks: ["high_water_consumption"],
        benefits: ["pollution_reduction"],
        balanceNotes: [],
        wasBalanced: false,
        originalIdea: "شجرة عملاقة تمتص التلوث وتضيء في الليل",
      },
      land.id,
      "user1",
      "contrib1",
    );
    expect(result.state.plants.some((p) => p.contributionId === "contrib1")).toBe(true);
    expect(result.state.events.some((e) => e.type === "CONTRIBUTION_APPLIED")).toBe(true);
    const advanced = advanceTick(result.state, 8);
    expect(advanced.state.tick).toBe(result.state.tick + 8);
  });
});

describe("pathfinding", () => {
  it("does not route through oceans by default", () => {
    const w = generateWorld({ planetId: "p1", seed: 5, full: false });
    const land = w.regions.filter((r) => r.biome !== "ocean");
    const a = land[0]!;
    const b = land[land.length - 1]!;
    const path = shortestPath(w, a.id, b.id);
    if (path) {
      for (const id of path.path) {
        const r = w.regions.find((x) => x.id === id)!;
        expect(r.biome).not.toBe("ocean");
      }
    }
  });
});

describe("population capacity", () => {
  it("species population stays non-negative after ticks", () => {
    const w = generateWorld({ planetId: "p1", seed: 77, full: false });
    const { state } = advanceTick(w, 15);
    for (const s of state.species) {
      expect(s.population).toBeGreaterThanOrEqual(0);
    }
  });
});
