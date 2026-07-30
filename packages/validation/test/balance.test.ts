import { describe, expect, it } from "vitest";
import { balanceContribution } from "../src/index";

describe("contribution balance", () => {
  it("rejects overpowered traits", () => {
    const result = balanceContribution({
      planetId: "p1",
      category: "creature",
      prompt: "An immortal dragon with infinite energy",
      traits: [{ name: "energy", value: 999 }],
      locale: "en"
    });
    expect(result.accepted).toBe(false);
    expect(result.notes.join(" ")).toMatch(/overpowered/i);
  });
});
