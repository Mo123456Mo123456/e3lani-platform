import { describe, expect, it } from "vitest";
import { SeededRNG } from "../seeded-rng.js";

describe("SeededRNG", () => {
  it("produces the same sequence for the same seed", () => {
    const a = new SeededRNG("planet-alpha");
    const b = new SeededRNG("planet-alpha");
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("diverges for different seeds", () => {
    const a = new SeededRNG("a");
    const b = new SeededRNG("b");
    expect(a.next()).not.toEqual(b.next());
  });

  it("nextFloat is in [0, 1)", () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("nextInt respects inclusive bounds", () => {
    const rng = new SeededRNG("ints");
    for (let i = 0; i < 50; i++) {
      const n = rng.nextInt(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it("pick and shuffle are deterministic", () => {
    const items = [1, 2, 3, 4, 5];
    const a = new SeededRNG("shuffle");
    const b = new SeededRNG("shuffle");
    expect(a.pick(items)).toEqual(b.pick(items));
    expect(a.shuffle(items)).toEqual(b.shuffle(items));
  });

  it("fork creates independent streams", () => {
    const root = new SeededRNG("root");
    const f1 = root.fork("a");
    const f2 = root.fork("a");
    const f3 = root.fork("b");
    expect(f1.next()).toEqual(f2.next());
    expect(f1.next()).not.toEqual(f3.next());
  });
});
