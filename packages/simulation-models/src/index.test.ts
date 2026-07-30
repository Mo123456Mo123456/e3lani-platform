import { describe, expect, it } from "vitest";
import { SeededRng, classifyBiome, fractalNoise, predatorPreyStep } from "./index.js";

describe("simulation-models", () => {
  it("is deterministic for same seed", () => {
    const a = new SeededRng("planet-born-alpha-2026");
    const b = new SeededRng("planet-born-alpha-2026");
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(fractalNoise("s", 1.2, 3.4)).toBe(fractalNoise("s", 1.2, 3.4));
  });

  it("classifies ocean for low elevation", () => {
    expect(classifyBiome(0, 0.1, 0.5, 0.5)).toBe("ocean");
  });

  it("updates predator-prey without negatives from sane inputs", () => {
    const r = predatorPreyStep(10, 2, { alpha: 0.1, beta: 0.02, gamma: 0.1, delta: 0.01 });
    expect(r.prey).toBeGreaterThanOrEqual(0);
    expect(r.predator).toBeGreaterThanOrEqual(0);
  });
});
