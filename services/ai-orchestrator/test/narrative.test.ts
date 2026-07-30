import { describe, expect, it } from "vitest";
import { narrateFromSimulation } from "../src/index";

describe("ai narrative guardrails", () => {
  it("does not invent events", async () => {
    const narrative = await narrateFromSimulation(
      [
        {
          id: "e1",
          planetId: "p1",
          tick: 2,
          type: "RESOURCE_DISCOVERED",
          title: "Found copper",
          description: "Copper veins were mapped.",
          causeEventIds: ["seed:p1"],
          actorIds: [],
          data: {},
          createdAt: new Date(0).toISOString()
        }
      ],
      "en"
    );
    expect(narrative).toContain("Found copper");
    expect(narrative).not.toMatch(/war|dragon|empire/i);
  });
});
