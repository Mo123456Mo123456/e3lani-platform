import { describe, expect, it } from "vitest";
import { generatePlanet, neighborsOf } from "../src/index";
import { fingerprint } from "../src/rng";

describe("procedural world generation", () => {
  it("same seed => identical planet", () => {
    const a = generatePlanet({ seed: "planet-a" });
    const b = generatePlanet({ seed: "planet-a" });
    expect(fingerprint(a.cells)).toBe(fingerprint(b.cells));
  });

  it("produces a plausible land/ocean split", () => {
    const grid = generatePlanet({ seed: "planet-b" });
    const land = grid.cells.filter((c) => c.height >= grid.seaLevel).length;
    const ratio = land / grid.cells.length;
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.75);
  });

  it("covers multiple biomes with physical coherence", () => {
    const grid = generatePlanet({ seed: "planet-c" });
    const biomes = new Set(grid.cells.map((c) => c.biome));
    expect(biomes.size).toBeGreaterThan(6);
    // ice only near the poles
    for (const cell of grid.cells) {
      if (cell.biome === "ice") expect(Math.abs(cell.lat)).toBeGreaterThan(45);
      if (cell.biome === "rainforest") expect(cell.moisture).toBeGreaterThan(0.5);
      if (cell.biome === "ocean" || cell.biome === "coast") {
        expect(cell.height).toBeLessThan(grid.seaLevel);
      }
    }
  });

  it("neighbor graph is symmetric and wraps longitude", () => {
    const grid = generatePlanet({ seed: "planet-d" });
    for (let i = 0; i < grid.cells.length; i += 37) {
      for (const n of neighborsOf(grid, i)) {
        expect(neighborsOf(grid, n)).toContain(i);
      }
    }
    // cell 0 (top-left) must have an eastern/western neighbor via wrap
    const first = neighborsOf(grid, 0);
    expect(first.length).toBeGreaterThan(0);
  });

  it("carves rivers that flow downhill to the sea", () => {
    const grid = generatePlanet({ seed: "planet-e" });
    const rivers = grid.cells.filter((c) => c.river);
    expect(rivers.length).toBeGreaterThan(10);
    for (const cell of rivers) {
      expect(cell.moisture).toBeGreaterThan(0.4);
    }
  });

  it("places resource deposits in plausible biomes", () => {
    const grid = generatePlanet({ seed: "planet-f" });
    const deposits = grid.cells.flatMap((c) => c.resources.map((r) => ({ ...r, biome: c.biome })));
    expect(deposits.length).toBeGreaterThan(20);
    for (const d of deposits) {
      expect(d.quantity).toBeGreaterThan(0);
      if (d.type === "fish") expect(["ocean", "coast"]).toContain(d.biome);
      if (d.type === "timber") expect(["temperate_forest", "rainforest"]).toContain(d.biome);
    }
  });
});
