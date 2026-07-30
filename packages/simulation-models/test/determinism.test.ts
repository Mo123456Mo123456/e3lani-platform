import { describe, expect, it } from "vitest";
import { SimulationEngine } from "../src/index";
import { fingerprint } from "../src/rng";

describe("determinism", () => {
  it("same seed produces identical state fingerprints", () => {
    const a = SimulationEngine.genesis({ seed: "det-seed-1", planetId: "p" });
    const b = SimulationEngine.genesis({ seed: "det-seed-1", planetId: "p" });
    a.run(120);
    b.run(120);
    expect(a.fingerprint()).toBe(b.fingerprint());
  });

  it("same seed produces identical event journals", () => {
    const a = SimulationEngine.genesis({ seed: "det-seed-2", planetId: "p" });
    const b = SimulationEngine.genesis({ seed: "det-seed-2", planetId: "p" });
    a.run(100);
    b.run(100);
    expect(a.journal.length).toBeGreaterThan(0);
    expect(fingerprint(a.journal)).toBe(fingerprint(b.journal));
  });

  it("different seeds diverge", () => {
    const a = SimulationEngine.genesis({ seed: "seed-alpha" });
    const b = SimulationEngine.genesis({ seed: "seed-beta" });
    a.run(60);
    b.run(60);
    expect(a.fingerprint()).not.toBe(b.fingerprint());
  });

  it("worldgen is bit-for-bit reproducible", () => {
    const a = SimulationEngine.genesis({ seed: "wg-det", planetId: "p" });
    const b = SimulationEngine.genesis({ seed: "wg-det", planetId: "p" });
    expect(fingerprint(a.state.grid.cells)).toBe(fingerprint(b.state.grid.cells));
  });
});
