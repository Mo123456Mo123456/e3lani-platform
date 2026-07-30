import { describe, expect, it } from "vitest";
import { WorldEventSchema } from "../src/index";

describe("shared event contracts", () => {
  it("rejects world events without a cause", () => {
    expect(() =>
      WorldEventSchema.parse({
        id: "e1",
        planetId: "p1",
        tick: 1,
        type: "RESOURCE_DISCOVERED",
        title: "Found water",
        description: "A spring was mapped.",
        causeEventIds: [],
        data: {},
        createdAt: new Date().toISOString()
      })
    ).toThrow();
  });
});
