import { describe, expect, it } from "vitest";
import { powerScore, validateBalance } from "../src/index";
import type { StructuredContribution } from "@planet/shared-types";

const overpowered: StructuredContribution = {
  category: "plant",
  name: "شجرة الأبد",
  description: "شجرة لا تموت وتتكاثر بلا حدود وتنتج طاقة غير محدودة",
  traits: {
    growthRate: 1,
    pollutionAbsorption: 1,
    energyStorage: 1,
    lifespan: 1,
    reproductionRate: 1,
    adaptability: 1,
    toxicity: 1,
    size: 1,
  },
  possibleBiomes: ["plains", "desert", "rainforest", "tundra"],
  risks: [],
};

const reasonable: StructuredContribution = {
  category: "plant",
  name: "شجرة الضوء",
  description: "شجرة تمتص التلوث وتضيء ليلاً",
  traits: {
    size: 0.7,
    growthRate: 0.3,
    waterNeed: 0.7,
    pollutionAbsorption: 0.8,
    nightLuminosity: 0.6,
    coldResistance: 0.3,
    heatResistance: 0.6,
  },
  possibleBiomes: ["temperate_forest"],
  risks: ["high_water_consumption"],
};

describe("contribution balance", () => {
  it("accepts a balanced contribution", () => {
    const report = validateBalance(reasonable);
    expect(report.balanced).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.suggested).toBeNull();
  });

  it("flags overpowered contributions and proposes a nerf", () => {
    const report = validateBalance(overpowered);
    expect(report.balanced).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.suggested).not.toBeNull();
    // the suggestion must itself validate cleanly
    const rebalanced = validateBalance(report.suggested!);
    expect(rebalanced.balanced).toBe(true);
    // and it must be weaker than the original
    expect(powerScore(report.suggested!)).toBeLessThan(powerScore(overpowered));
  });

  it("detects forbidden combos", () => {
    const plague: StructuredContribution = {
      category: "creature",
      name: "الطاعون الخالد",
      description: "",
      traits: { reproductionRate: 0.95, adaptability: 0.9, toxicity: 0.9 },
      possibleBiomes: [],
      risks: [],
    };
    const report = validateBalance(plague);
    expect(report.violations.some((v) => v.code === "FORBIDDEN_COMBO")).toBe(true);
  });

  it("weakness traits do not count as power", () => {
    const thirsty: StructuredContribution = {
      ...reasonable,
      traits: { ...reasonable.traits, waterNeed: 0.95 },
    };
    expect(powerScore(thirsty)).toBeLessThan(powerScore({ ...reasonable, traits: { ...reasonable.traits, growthRate: 0.95 } }));
  });
});
