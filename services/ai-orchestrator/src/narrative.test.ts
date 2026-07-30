import { describe, expect, it } from "vitest";
import { MockProvider } from "./providers/mock.js";

describe("AI narrative grounding", () => {
  it("does not invent events beyond provided simulation data", async () => {
    const provider = new MockProvider();
    const result = await provider.narrate({
      locale: "ar",
      contributionName: "شجرة الضوء",
      effects: [
        { domain: "pollution", metric: "pollution", delta: -0.18 },
        { domain: "environment", metric: "water_stress", delta: 0.12 },
      ],
      eventTitles: ["انتشار شجرة الضوء"],
    });
    expect(result.narrative).toContain("شجرة الضوء");
    expect(result.narrative).toContain("pollution");
    expect(result.narrative).not.toContain("انقراض حضارة غير مذكورة");
    expect(result.narrative).toContain("انتشار شجرة الضوء");
  });

  it("structures plant idea with balance constraints", async () => {
    const provider = new MockProvider();
    const structured = await provider.parseIdea({
      category: "plant",
      idea: "شجرة عملاقة تمتص التلوث وتضيء في الليل ولا تموت",
      locale: "ar",
    });
    expect(structured.category).toBe("plant");
    expect(structured.wasBalanced).toBe(true);
    expect(structured.traits.pollutionAbsorption!).toBeLessThanOrEqual(0.85);
    expect(structured.possibleBiomes.length).toBeGreaterThan(0);
  });
});
