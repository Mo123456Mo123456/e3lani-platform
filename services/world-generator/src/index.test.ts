import { describe, expect, it } from "vitest";
import { generatePlanet } from "./index.js";

describe("deterministic planet generation", () => {
  it("reproduces the same regions and checksum from one seed", () => {
    const first = generatePlanet("kepler-arabia-7", 8, 16);
    const second = generatePlanet("kepler-arabia-7", 8, 16);
    expect(first).toEqual(second);
    expect(first.regions).toHaveLength(128);
  });

  it("changes the generated world when the seed changes", () => {
    expect(generatePlanet("alpha", 8, 16).checksum).not.toBe(generatePlanet("beta", 8, 16).checksum);
  });

  it("never creates an unclassified or over-capacity region", () => {
    for (const region of generatePlanet("invariants", 8, 16).regions) {
      expect(region.biome).toBeTruthy();
      expect(region.carryingCapacity).toBeGreaterThanOrEqual(0);
      expect(region.temperature).toBeGreaterThanOrEqual(0);
      expect(region.temperature).toBeLessThanOrEqual(1);
    }
  });
});
