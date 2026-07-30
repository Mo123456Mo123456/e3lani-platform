import { describe, expect, it } from "vitest";
import { SimplexNoise2D, SeededRandom } from "./noise";
import { classifyBiome } from "./biomes";
import { generateFallbackPlanet } from "./fallback-planet";
import { cellIdFromLatLon, latLonFromCell, latLonToVec3, vec3ToLatLon } from "./geo";

describe("SeededRandom", () => {
  it("is deterministic per seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 10; i++) expect(a.random()).toBe(b.random());
  });
  it("differs across seeds", () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    expect(a.random()).not.toBe(b.random());
  });
});

describe("SimplexNoise2D", () => {
  it("produces identical fields for identical seeds", () => {
    const a = new SimplexNoise2D(7);
    const b = new SimplexNoise2D(7);
    expect(a.fbm(1.5, 2.5)).toBe(b.fbm(1.5, 2.5));
  });
  it("stays in [-1, 1]", () => {
    const n = new SimplexNoise2D(7);
    for (let i = 0; i < 200; i++) {
      const v = n.noise(i * 0.37, i * 0.91);
      expect(v).toBeGreaterThanOrEqual(-1.01);
      expect(v).toBeLessThanOrEqual(1.01);
    }
  });
});

describe("classifyBiome", () => {
  it("classifies ocean below sea level", () => {
    expect(classifyBiome(0.2, 20, 0.9, false, false)).toBe("ocean");
  });
  it("classifies hot wet land as rainforest", () => {
    expect(classifyBiome(0.6, 28, 0.9, false, false)).toBe("rainforest");
  });
  it("classifies hot dry land as desert", () => {
    expect(classifyBiome(0.6, 32, 0.05, false, false)).toBe("desert");
  });
  it("classifies polar land as ice", () => {
    expect(classifyBiome(0.6, -20, 0.5, false, false)).toBe("ice");
  });
});

describe("fallback planet", () => {
  it("generates all layers at grid resolution", () => {
    const p = generateFallbackPlanet(5, 24, 12);
    expect(p.layers.biome.length).toBe(24 * 12 * 4);
    expect(p.layers.height.length).toBe(24 * 12 * 4);
  });
  it("is deterministic", () => {
    const a = generateFallbackPlanet(5, 24, 12);
    const b = generateFallbackPlanet(5, 24, 12);
    expect(Array.from(a.layers.biome)).toEqual(Array.from(b.layers.biome));
  });
});

describe("geo", () => {
  it("cell <-> latlon round trips", () => {
    const dims = { latBands: 36, lonBands: 72 };
    const id = cellIdFromLatLon(dims, 12.3, 44.9);
    const { lat, lon } = latLonFromCell(dims, id);
    expect(cellIdFromLatLon(dims, lat, lon)).toBe(id);
  });
  it("vec3 <-> latlon round trips", () => {
    const [x, y, z] = latLonToVec3(35, 60, 1);
    const { lat, lon } = vec3ToLatLon(x, y, z);
    expect(lat).toBeCloseTo(35, 1);
    expect(lon).toBeCloseTo(60, 1);
  });
});
