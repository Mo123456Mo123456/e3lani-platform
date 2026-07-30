import { describe, expect, it } from "vitest";
import { dijkstra, SeededRandom, updatePopulation } from "../src/index";

describe("simulation model primitives", () => {
  it("SeededRandom is deterministic", () => {
    const a = new SeededRandom("seed");
    const b = new SeededRandom("seed");
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("Dijkstra finds the cheapest trade route", () => {
    expect(
      dijkstra(
        {
          a: [{ to: "b", cost: 5 }, { to: "c", cost: 1 }],
          b: [{ to: "d", cost: 1 }],
          c: [{ to: "b", cost: 1 }, { to: "d", cost: 7 }],
          d: []
        },
        "a",
        "d"
      )
    ).toEqual({ distance: 3, path: ["a", "c", "b", "d"] });
  });

  it("population update respects carrying capacity", () => {
    expect(updatePopulation({ population: 990, growthRate: 0.5, carryingCapacity: 1000 })).toBeLessThanOrEqual(1000);
  });
});
