import { describe, expect, it } from "vitest";
import { balanceUserElement } from "../balance.js";

describe("balanceUserElement", () => {
  it("rejects immortality", () => {
    const result = balanceUserElement({ immortality: true, strength: 0.5 });
    expect(result.rejected).toBe(true);
    expect(result.balanced.immortality).toBeUndefined();
    expect(result.balanced.lifespan).toBeLessThanOrEqual(0.95);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it("rejects infinite energy", () => {
    const result = balanceUserElement({ infiniteEnergy: true });
    expect(result.rejected).toBe(true);
    expect(result.balanced.infiniteEnergy).toBeUndefined();
    expect(result.balanced.renewability).toBeLessThanOrEqual(0.9);
  });

  it("rejects invincible/omnipotent", () => {
    const result = balanceUserElement({ invincible: true, omnipotent: true });
    expect(result.rejected).toBe(true);
    expect(result.balanced.invincible).toBeUndefined();
    expect(result.balanced.omnipotent).toBeUndefined();
  });

  it("caps overpowered numeric traits", () => {
    const result = balanceUserElement({
      strength: 99,
      reproductionRate: 50,
      lethality: 1,
      infectivity: 1,
    });
    expect(result.balanced.strength).toBeLessThanOrEqual(0.9);
    expect(result.balanced.reproductionRate).toBeLessThanOrEqual(0.85);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("allows reasonable traits", () => {
    const result = balanceUserElement({
      strength: 0.5,
      intelligence: 0.4,
      size: 0.3,
      reproductionRate: 0.35,
    });
    expect(result.balanced.strength).toBe(0.5);
    expect(result.rejected).toBe(false);
  });
});
