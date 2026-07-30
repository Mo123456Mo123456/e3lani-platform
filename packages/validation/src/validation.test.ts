import { describe, expect, it } from "vitest";
import { parsedContributionSchema, registerSchema, traitsSchema } from "./index.js";

describe("traitsSchema", () => {
  it("accepts normalised traits", () => {
    expect(traitsSchema.safeParse({ size: 0.9, waterNeed: 0.2 }).success).toBe(true);
  });
  it("rejects out-of-range traits", () => {
    expect(traitsSchema.safeParse({ size: 1.5 }).success).toBe(false);
    expect(traitsSchema.safeParse({ size: -0.1 }).success).toBe(false);
  });
  it("allows bounded multipliers", () => {
    expect(traitsSchema.safeParse({ warProbabilityMultiplier: 0.5 }).success).toBe(true);
    expect(traitsSchema.safeParse({ warProbabilityMultiplier: 99 }).success).toBe(false);
  });
});

describe("parsedContributionSchema", () => {
  it("validates the light-tree example from the spec", () => {
    const parsed = {
      category: "plant",
      name: "شجرة الضوء العملاقة",
      description: "شجرة عملاقة تمتص التلوث وتضيء في الليل",
      traits: {
        size: 0.9,
        growthRate: 0.3,
        waterNeed: 0.7,
        pollutionAbsorption: 0.95,
        luminosity: 0.8,
        coldResistance: 0.4,
        heatResistance: 0.7,
      },
      possibleBiomes: ["rainforest", "temperate_forest"],
      risks: ["high_water_consumption", "ecosystem_competition"],
      benefits: ["pollution_reduction"],
    };
    const result = parsedContributionSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("rejects invalid category", () => {
    const bad = { category: "nuclear_bomb", name: "x", description: "", traits: {}, possibleBiomes: [], risks: [], benefits: [] };
    expect(parsedContributionSchema.safeParse(bad).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("requires a strong-ish password", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "short", displayName: "ab" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "long-enough-1", displayName: "ab" }).success).toBe(true);
  });
});
