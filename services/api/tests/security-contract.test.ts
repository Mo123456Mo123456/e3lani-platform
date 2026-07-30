import { describe, expect, it } from "vitest";
import { contributionCommitSchema } from "@planet/shared-types";
import { createAnalysisProvider } from "@planet/ai-orchestrator";

describe("API security contracts", () => {
  it("does not silently enable sandbox AI in production", () => {
    expect(() =>
      createAnalysisProvider({
        NODE_ENV: "production",
        AI_PROVIDER: "sandbox",
      }),
    ).toThrow(/real AI provider/);
  });

  it("rejects out-of-range structured traits before persistence", () => {
    expect(() =>
      contributionCommitSchema.parse({
        regionId: "38968d76-a91d-4c04-a6d5-fb75ea21f3cf",
        expectedVersion: 1,
        analysis: {
          category: "plant",
          name: "Unsafe plant",
          description: "A deliberately invalid contribution payload",
          traits: { growthRate: 4, waterNeed: 0.2 },
          possibleBiomes: ["plains"],
          risks: [],
          balancedChanges: [],
          provider: "sandbox-rule-engine",
          model: "test",
        },
      }),
    ).toThrow();
  });
});
