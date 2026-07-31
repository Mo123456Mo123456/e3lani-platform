import { describe, expect, it } from "vitest";
import { WorldEventType, type WorldEvent } from "@planet/shared-types";
import { isNotifiable, notificationText } from "./main.js";

function ev(overrides: Partial<WorldEvent>): WorldEvent {
  return {
    seq: 1, tick: 5, year: 5, type: WorldEventType.PlantSpread,
    payload: { name: "شجرة الضوء" }, causes: [], confidence: 1,
    importance: 0.4, hash: "x", ...overrides,
  };
}

describe("notification rules", () => {
  it("notifies only contribution-linked consequential events", () => {
    expect(isNotifiable(ev({ contributionId: "c1" }))).toBe(true);
    expect(isNotifiable(ev({ contributionId: undefined }))).toBe(false);
    expect(isNotifiable(ev({ contributionId: "c1", type: WorldEventType.ContributionApplied }))).toBe(false);
    expect(isNotifiable(ev({ contributionId: "c1", importance: 0.1 }))).toBe(false);
  });

  it("produces Arabic notification text with element names", () => {
    const { title } = notificationText(ev({ contributionId: "c1", type: WorldEventType.SpeciesExtinct }), "ar");
    expect(title).toContain("شجرة الضوء");
    expect(title).toContain("انقرض");
  });

  it("produces English text too", () => {
    const { title } = notificationText(ev({ contributionId: "c1", type: WorldEventType.WarStarted }), "en");
    expect(title.toLowerCase()).toContain("war");
  });
});
