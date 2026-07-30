import { describe, expect, it } from "vitest";
import { SandboxProvider } from "./providers.js";

describe("AI sandbox provider", () => {
  it("parses light-tree idea into plant traits", async () => {
    const p = new SandboxProvider();
    const result = await p.analyze(
      "plant",
      "أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل",
      "ar",
    );
    expect(result.sandbox).toBe(true);
    expect(result.structured.traits.pollutionAbsorption!).toBeGreaterThan(0.5);
    expect(result.structured.traits.nightLuminosity!).toBeGreaterThan(0.5);
  });

  it("narrate never invents beyond events", async () => {
    const p = new SandboxProvider();
    const n = await p.narrate([
      {
        title: "A",
        titleAr: "أ",
        description: "Pollution dropped 18%.",
        descriptionAr: "انخفض التلوث بنسبة 18%.",
        type: "PLANT_SPREAD",
      },
    ]);
    expect(n.narrative).toContain("18%");
    expect(n.narrativeAr).toContain("18%");
    expect(n.narrative).not.toContain("dragon");
  });
});
