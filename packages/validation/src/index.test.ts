import { describe, expect, it } from "vitest";
import { detectForbiddenContent, structuredElementSchema } from "./index.js";

describe("validation", () => {
  it("accepts balanced plant element", () => {
    const parsed = structuredElementSchema.parse({
      category: "plant",
      name: "Light Tree",
      description: "Absorbs pollution",
      traits: {
        size: 0.8,
        growthRate: 0.3,
        waterNeed: 0.7,
        heatResistance: 0.6,
        coldResistance: 0.4,
      },
      possibleBiomes: ["rainforest"],
      risks: ["water"],
      benefits: ["clean air"],
      balanceScore: 0.7,
      wasBalanced: true,
    });
    expect(parsed.category).toBe("plant");
  });

  it("flags god-mode text", () => {
    expect(detectForbiddenContent("make an immortal being").length).toBeGreaterThan(0);
    expect(detectForbiddenContent("شجرة عادية").length).toBe(0);
  });
});
