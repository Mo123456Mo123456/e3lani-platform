import { describe, expect, it } from "vitest";
import { ProceduralPlanetGenerator, BIOME_LIST } from "../world-generator.js";

describe("ProceduralPlanetGenerator", () => {
  it("produces identical terrain for the same seed", () => {
    const a = new ProceduralPlanetGenerator("terra-1", 32).generate();
    const b = new ProceduralPlanetGenerator("terra-1", 32).generate();
    expect([...a.heightMap]).toEqual([...b.heightMap]);
    expect([...a.moistureMap]).toEqual([...b.moistureMap]);
    expect([...a.temperatureMap]).toEqual([...b.temperatureMap]);
    expect([...a.biomeMap]).toEqual([...b.biomeMap]);
    expect(a.rivers.length).toEqual(b.rivers.length);
    expect(a.plates.length).toEqual(b.plates.length);
  });

  it("diverges for different seeds", () => {
    const a = new ProceduralPlanetGenerator("x", 32).generate();
    const b = new ProceduralPlanetGenerator("y", 32).generate();
    expect([...a.heightMap]).not.toEqual([...b.heightMap]);
  });

  it("uses only known biome ids", () => {
    const t = new ProceduralPlanetGenerator("biomes", 24).generate();
    for (const id of t.biomeMap) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(BIOME_LIST.length);
    }
  });

  it("returns region summaries", () => {
    const t = new ProceduralPlanetGenerator("regions", 32).generate();
    expect(t.regions.length).toBeGreaterThan(0);
    expect(t.regions[0]?.id).toMatch(/^r\d+_\d+$/);
  });
});
