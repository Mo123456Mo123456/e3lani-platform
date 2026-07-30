import { describe, expect, it } from "vitest";
import { generateWorld, worldFingerprint } from "./world-generator.js";
import { advanceTicks } from "./tick-engine.js";
import { applyContribution } from "./apply-contribution.js";
import { balanceContribution } from "./balance.js";

describe("simulation determinism", () => {
  it("same seed produces same world fingerprint", () => {
    const a = generateWorld({ planetId: "p1", seed: 42424242 });
    const b = generateWorld({ planetId: "p1", seed: 42424242 });
    expect(worldFingerprint(a)).toBe(worldFingerprint(b));
    expect(a.civilizations).toHaveLength(12);
    expect(a.cities).toHaveLength(40);
    expect(a.resources).toHaveLength(120);
    expect(a.species).toHaveLength(300);
    expect(a.plants).toHaveLength(800);
    expect(a.technologies).toHaveLength(50);
  });

  it("replaying ticks from same seed yields identical state", () => {
    const base = generateWorld({ planetId: "p1", seed: 99 });
    const r1 = advanceTicks(base, 25);
    const r2 = advanceTicks(base, 25);
    expect(worldFingerprint(r1.state)).toBe(worldFingerprint(r2.state));
    expect(r1.events.map((e) => e.id)).toEqual(r2.events.map((e) => e.id));
  });

  it("does not create civilization without population capacity context", () => {
    const world = generateWorld({ planetId: "p1", seed: 7 });
    for (const civ of world.civilizations) {
      expect(civ.population).toBeGreaterThan(0);
      const capital = world.regions.find((r) => r.id === civ.capitalRegionId);
      expect(capital).toBeTruthy();
      expect(capital!.carryingCapacity).toBeGreaterThan(0);
    }
  });

  it("events always carry causes", () => {
    const world = generateWorld({ planetId: "p1", seed: 3 });
    const advanced = advanceTicks(world, 40);
    for (const event of advanced.events) {
      expect(event.causes.length).toBeGreaterThan(0);
    }
  });

  it("balances overpowered contributions", () => {
    const balanced = balanceContribution({
      category: "plant",
      name: "شجرة خالدة",
      description: "لا تموت وتنتج طاقة غير محدودة",
      traits: { pollutionAbsorption: 1, reproduction: 0.99, size: 0.99 },
      possibleBiomes: ["rainforest"],
      risks: [],
      benefits: [],
      balanceNotes: [],
      wasBalanced: false,
      originalIdea: "شجرة لا تموت وطاقة غير محدودة",
    });
    expect(balanced.wasBalanced).toBe(true);
    expect(balanced.traits.pollutionAbsorption!).toBeLessThanOrEqual(0.85);
  });

  it("applies contribution into world state and event log", () => {
    const world = generateWorld({ planetId: "p1", seed: 11 });
    const region = world.regions.find((r) => r.biome === "temperate_forest")!;
    const result = applyContribution({
      state: world,
      userId: "u1",
      contributionId: "c1",
      regionId: region.id,
      structured: {
        category: "plant",
        name: "شجرة الضوء",
        nameEn: "Light Tree",
        description: "تمتص التلوث وتضيء ليلاً",
        traits: {
          pollutionAbsorption: 0.8,
          waterNeed: 0.7,
          growthRate: 0.3,
          nightLuminosity: 0.8,
        },
        possibleBiomes: ["temperate_forest", "rainforest"],
        risks: ["high_water_consumption"],
        benefits: ["pollution_reduction"],
        balanceNotes: [],
        wasBalanced: false,
        originalIdea: "شجرة عملاقة تمتص التلوث وتضيء في الليل",
      },
      simulateYears: 2,
    });
    expect(result.state.plants.some((p) => p.contributionId === "c1")).toBe(true);
    expect(result.event.type).toBe("USER_CONTRIBUTION_APPLIED");
    expect(result.causalGraph.nodes.length).toBeGreaterThan(1);
    expect(result.scenarios.length).toBeGreaterThan(0);
  });
});
