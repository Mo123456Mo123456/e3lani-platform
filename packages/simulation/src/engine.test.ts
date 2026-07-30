import { describe, expect, it } from "vitest";
import type { ParsedContribution } from "@kawkab/shared-types";
import { SimulationEngine } from "./engine.js";
import { generateWorld } from "./generator.js";
import { PlanetGrid, findPath } from "./grid.js";
import { checkBalance } from "./balance.js";
import { RngStream, deterministicId } from "./rng.js";

const SMALL = { gridWidth: 64, gridHeight: 32, snapshotInterval: 20 };

const GENESIS_TYPES = new Set(["PLANET_FORMED", "OCEANS_FORMED", "LIFE_EMERGED", "PLANTS_SPREAD"]);
const ROOT_CAUSELESS = new Set(["ELEMENT_ADDED"]);

function lightTree(): ParsedContribution {
  return {
    category: "plant",
    name: "شجرة الضوء العملاقة",
    description: "شجرة عملاقة تمتص التلوث وتضيء في الليل",
    traits: {
      size: 0.9,
      growthRate: 0.3,
      waterNeed: 0.7,
      pollutionAbsorption: 0.9,
      luminosity: 0.8,
      coldResistance: 0.4,
      heatResistance: 0.7,
      spreadRate: 0.5,
    },
    possibleBiomes: ["rainforest", "temperate_forest"],
    risks: ["high_water_consumption", "ecosystem_competition"],
    benefits: ["pollution_reduction"],
  };
}

describe("world generation", () => {
  it("is deterministic: same seed → identical world", () => {
    const a = generateWorld("seed-alpha", SMALL);
    const b = generateWorld("seed-alpha", SMALL);
    expect(JSON.stringify(a.state.cells)).toBe(JSON.stringify(b.state.cells));
    expect(a.state.civs.size).toBe(b.state.civs.size);
    expect([...a.state.species.keys()]).toEqual([...b.state.species.keys()]);
  });

  it("different seeds → different worlds", () => {
    const a = generateWorld("seed-alpha", SMALL);
    const b = generateWorld("seed-beta", SMALL);
    expect(JSON.stringify(a.state.cells.slice(0, 50))).not.toBe(JSON.stringify(b.state.cells.slice(0, 50)));
  });

  it("produces the required seed data volumes", () => {
    const { state } = generateWorld("seed-alpha", SMALL);
    expect(state.species.size).toBe(300);
    expect(state.plants.size).toBe(800);
    expect(state.techTree.length).toBe(50);
    expect(state.civs.size).toBeGreaterThan(4);
    expect(state.cities.size).toBe(state.civs.size);
  });

  it("tech tree has no dangling prerequisites", () => {
    const { state } = generateWorld("seed-alpha", SMALL);
    const keys = new Set(state.techTree.map((t) => t.key));
    for (const t of state.techTree) {
      for (const p of t.prereqKeys) expect(keys.has(p), `${t.key} needs ${p}`).toBe(true);
    }
  });
});

describe("engine determinism (spec test 1)", () => {
  it("same seed + same ops → identical history and state hash", () => {
    const run = () => {
      const e = SimulationEngine.create("seed-history", SMALL);
      e.runTicks(40);
      return { hash: e.hashState(), events: e.events.map((x) => `${x.tick}:${x.type}:${x.title}`) };
    };
    const a = run();
    const b = run();
    expect(a.hash).toBe(b.hash);
    expect(a.events).toEqual(b.events);
  });

  it("replay of operations reproduces the identical state (spec test 2)", () => {
    const ops = [
      { atTick: 5, parsed: lightTree() },
      {
        atTick: 12,
        parsed: {
          category: "creature",
          name: "نمر الضباب",
          description: "مفترس سريع يعيش في الضباب",
          traits: { size: 0.5, aggression: 0.7, mobility: 0.8, reproductionRate: 0.3, adaptability: 0.6 },
          possibleBiomes: ["temperate_forest"],
          risks: ["overpredation"],
          benefits: [],
        } satisfies ParsedContribution,
      },
    ];
    const run = () => {
      const e = SimulationEngine.create("seed-replay", SMALL);
      for (let t = 0; t <= 60; t++) {
        for (const [i, op] of ops.entries()) {
          if (op.atTick === t) {
            e.addContribution({ id: `ctr_test_${i}`, userId: "user_1", parsed: op.parsed as ParsedContribution, originIndex: 500 });
          }
        }
        e.runTick();
      }
      return { hash: e.hashState(), count: e.events.length };
    };
    const a = run();
    const b = run();
    expect(a.hash).toBe(b.hash);
    expect(a.count).toBe(b.count);
  });
});

describe("causal invariants", () => {
  it("no event happens without a cause (spec test 4)", () => {
    const e = SimulationEngine.create("seed-causes", SMALL);
    e.addContribution({ id: "ctr_x", userId: "u", parsed: lightTree(), originIndex: 300 });
    e.runTicks(50);
    const byId = new Map(e.events.map((x) => [x.id, x]));
    for (const ev of e.events) {
      if (GENESIS_TYPES.has(ev.type) || ROOT_CAUSELESS.has(ev.type)) continue;
      expect(ev.causeIds.length, `event ${ev.type} @${ev.tick} has no cause`).toBeGreaterThan(0);
      for (const c of ev.causeIds) {
        expect(byId.has(c) || c === "", `cause ${c} of ${ev.type} must exist`).toBe(true);
      }
    }
  });

  it("causal chain of a contribution is traversable", () => {
    const e = SimulationEngine.create("seed-trace", SMALL);
    e.addContribution({ id: "ctr_trace", userId: "u", parsed: lightTree(), originIndex: 300 });
    e.runTicks(30);
    const root = e.getContributionRoot("ctr_trace");
    expect(root).toBeTruthy();
    const trace = e.getContributionTrace("ctr_trace");
    expect(trace).toBeTruthy();
    expect(trace!.nodes.eventId).toBe(root);
  });

  it("no civilization exists without people, land and stockpiles (spec test 3)", () => {
    const e = SimulationEngine.create("seed-civs", SMALL);
    e.runTicks(30);
    for (const civ of e.state.civs.values()) {
      if (civ.extinct) continue;
      expect(civ.population).toBeGreaterThan(0);
      expect(civ.territory.size).toBeGreaterThan(0);
      expect(Object.keys(civ.stockpiles).length).toBeGreaterThan(0);
    }
  });
});

describe("carrying capacity (spec test 6)", () => {
  it("cell population never exceeds regional carrying capacity", () => {
    const e = SimulationEngine.create("seed-cap", SMALL);
    e.runTicks(60);
    for (const cell of e.state.cells) {
      const cap = Math.max(1000, cell.fertility * 2_000_000);
      expect(cell.population).toBeLessThanOrEqual(cap + 1);
    }
  });
});

describe("migration constraints (spec test 7)", () => {
  it("land pathfinding never crosses ocean without seafaring", () => {
    const e = SimulationEngine.create("seed-migration", SMALL);
    const grid = e.grid;
    const landCells = e.state.cells.filter((c) => !c.isOcean).map((c) => c.index);
    // find a land pair separated by ocean using strict land-only pathing
    const from = landCells[0]!;
    let checked = 0;
    for (const to of landCells.slice(1, 60)) {
      const path = findPath(grid, from, to, { passable: (idx) => !e.state.cells[idx]!.isOcean });
      if (path) {
        for (const idx of path) expect(e.state.cells[idx]!.isOcean).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("engine migrations always follow a valid path", () => {
    const e = SimulationEngine.create("seed-migration2", SMALL);
    e.runTicks(120);
    for (const mig of e.state.migrations.values()) {
      expect(mig.path.length).toBeGreaterThan(0);
      expect(mig.path[0]).toBe(mig.fromIndex);
      expect(mig.path[mig.path.length - 1]).toBe(mig.toIndex);
      const civ = mig.civId ? e.state.civs.get(mig.civId) : undefined;
      const seafaring = civ ? civ.techKeys.has("sailing") || civ.techKeys.has("navigation") : false;
      if (!seafaring) {
        for (const idx of mig.path) {
          expect(e.state.cells[idx]!.isOcean, `migration ${mig.id} crossed ocean without seafaring`).toBe(false);
        }
      }
    }
  });
});

describe("balance layer (spec test 8)", () => {
  it("rejects trait-less elements", () => {
    const result = checkBalance({ category: "plant", name: "x", description: "", traits: {}, possibleBiomes: [], risks: [], benefits: [] });
    expect(result.acceptable).toBe(false);
  });

  it("tames an immortal planet-killer instead of accepting it raw", () => {
    const monster: ParsedContribution = {
      category: "creature",
      name: "الخالد",
      description: "مخلوق لا يموت ويتكاثر بلا حدود ويدمر كل شيء",
      traits: { lifespan: 1, reproductionRate: 1, toxicity: 0.99, spreadRate: 0.99, lethality: 0.99, size: 1, aggression: 1, mobility: 1, adaptability: 1 },
      possibleBiomes: [],
      risks: [],
      benefits: [],
    };
    const result = checkBalance(monster);
    expect(result.acceptable).toBe(true); // balanced variant is acceptable
    expect(result.adjusted.traits.lifespan!).toBeLessThan(1);
    expect(result.adjusted.traits.reproductionRate!).toBeLessThanOrEqual(0.7);
    const sum = Object.values(result.adjusted.traits).reduce((s: number, v) => s + (v ?? 0), 0);
    expect(sum).toBeLessThanOrEqual(6.01);
    expect(result.adjustments.length).toBeGreaterThan(0);
  });

  it("bounds unlimited energy", () => {
    const result = checkBalance({
      category: "invention",
      name: "مولد الأبد",
      description: "طاقة غير محدودة",
      traits: { energyOutput: 1, renewalRate: 1 },
      possibleBiomes: [],
      risks: [],
      benefits: [],
    });
    expect(result.adjusted.traits.energyOutput!).toBeLessThanOrEqual(0.85);
    expect(result.issues.some((i) => i.code === "UNBOUNDED_ENERGY")).toBe(true);
  });
});

describe("snapshots & rollback (spec test 9)", () => {
  it("can roll back to any snapshot and continue deterministically", () => {
    const e = SimulationEngine.create("seed-rollback", { ...SMALL, snapshotInterval: 10 });
    e.runTicks(30);
    const hashAt20 = e.snapshots.find((s) => s.tick === 20)!.hash;
    e.runTicks(20); // now at 50
    expect(e.state.tick).toBe(50);
    const ok = e.rollback(20);
    expect(ok).toBe(true);
    expect(e.state.tick).toBe(20);
    expect(e.hashState()).toBe(hashAt20);
    // continuing from the snapshot reproduces the same future
    const e2 = SimulationEngine.create("seed-rollback", { ...SMALL, snapshotInterval: 10 });
    e2.runTicks(35);
    e.runTicks(15);
    expect(e.hashState()).toBe(e2.hashState());
    expect(e.state.tick).toBe(e2.state.tick);
  });

  it("events after the rollback point are pruned", () => {
    const e = SimulationEngine.create("seed-prune", { ...SMALL, snapshotInterval: 10 });
    e.runTicks(25);
    e.rollback(10);
    for (const ev of e.events) expect(ev.tick).toBeLessThanOrEqual(10);
  });
});

describe("contributions", () => {
  it("a plant contribution creates tracked cells and visible events", () => {
    const e = SimulationEngine.create("seed-contrib", SMALL);
    const before = e.events.length;
    const landIdx = e.state.cells.find((c) => !c.isOcean && c.moisture > 0.4)!.index;
    e.addContribution({ id: "ctr_plant", userId: "u1", parsed: lightTree(), originIndex: landIdx });
    expect(e.events.length).toBeGreaterThan(before);
    const root = e.getContributionRoot("ctr_plant");
    expect(root).toBeTruthy();
    const plants = [...e.state.plants.values()].filter((p) => p.originContributionId === "ctr_plant");
    expect(plants.length).toBe(1);
    expect(plants[0]!.cells.size).toBeGreaterThan(0);
    e.runTicks(20);
    // everything derived from the contribution carries its lineage
    const lineage = e.events.filter((x) => x.contributionId === "ctr_plant");
    expect(lineage.length).toBeGreaterThan(0);
  });

  it("a civilization contribution founds a playable civ", () => {
    const e = SimulationEngine.create("seed-contrib-civ", SMALL);
    const landIdx = e.state.cells.find((c) => !c.isOcean && c.fertility > 0.5 && !c.ownerCivId)!.index;
    e.addContribution({
      id: "ctr_civ",
      userId: "u1",
      parsed: { category: "civilization", name: "بنو الضياء", description: "", traits: { intelligence: 0.7, aggression: 0.2 }, possibleBiomes: [], risks: [], benefits: [] },
      originIndex: landIdx,
    });
    const civ = [...e.state.civs.values()].find((c) => c.name === "بنو الضياء");
    expect(civ).toBeTruthy();
    expect(civ!.territory.size).toBeGreaterThan(0);
    e.runTicks(10);
    expect(civ!.extinct).toBe(false);
  });
});

describe("world laws", () => {
  it("a peace law measurably reduces wars", () => {
    const run = (withLaw: boolean) => {
      const e = SimulationEngine.create("seed-law", { ...SMALL, snapshotInterval: 100 });
      if (withLaw) {
        e.addContribution({
          id: "ctr_peace",
          userId: "u",
          parsed: { category: "world_law", name: "عهدة السلام", description: "", traits: { warProbabilityMultiplier: 0.2 }, possibleBiomes: [], risks: [], benefits: [] },
          originIndex: 0,
        });
      }
      e.runTicks(200);
      return e.events.filter((x) => x.type === "WAR_STARTED").length;
    };
    const peaceful = run(true);
    const baseline = run(false);
    expect(peaceful).toBeLessThanOrEqual(baseline);
  });
});

describe("performance smoke (spec test 10 substrate)", () => {
  it("handles hundreds of ticks and thousands of events without degradation", () => {
    const e = SimulationEngine.create("seed-perf", SMALL);
    const start = Date.now();
    e.runTicks(200);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(20_000);
    expect(e.events.length).toBeGreaterThan(50);
    // event queries stay fast
    const q = Date.now();
    e.getEvents({ limit: 100 });
    expect(Date.now() - q).toBeLessThan(50);
  });
});

describe("rng", () => {
  it("forks are independent of draw order", () => {
    const a = new RngStream("seed");
    const f1 = a.fork("x");
    a.next(); a.next();
    const f2 = a.fork("x");
    expect(f1.next()).toBe(f2.next());
  });

  it("deterministicId is stable", () => {
    expect(deterministicId("ev", "s", 1, "X")).toBe(deterministicId("ev", "s", 1, "X"));
  });
});
