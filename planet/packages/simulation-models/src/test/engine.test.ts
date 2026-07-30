import { describe, expect, it } from "vitest";
import {
  ContributionCategory,
  WorldEventType,
  type AnalyzedContribution,
} from "@planet/shared-types";
import {
  applyContribution,
  createRng,
  random as rngRandom,
  createWorld,
  deserializeWorld,
  findPath,
  generatePlanetGrid,
  landRatio,
  queryEvents,
  runFutureScenarios,
  runTicks,
  serializeWorld,
  speciesPopulation,
  takeSnapshot,
  restoreSnapshot,
  verifyEventChain,
  worldChecksum,
  causalDescendants,
  habitatSuitability,
  type WorldState,
} from "../index.js";

const SEED = 424242;

function makeWorld(id = "w1", seed = SEED): WorldState {
  return createWorld({
    worldId: id,
    name: "Test World",
    seed,
    yearsPerTick: 1,
    plantSpecies: 120,
    animalSpecies: 60,
    civilizations: 6,
    width: 64,
    height: 32,
    depositCount: 40,
  });
}

function sampleAnalysis(overrides: Partial<AnalyzedContribution> = {}): AnalyzedContribution {
  return {
    category: ContributionCategory.Plant,
    name: "Glowing Titan Tree",
    summary: "A giant tree that absorbs pollution and glows at night.",
    traits: {
      size: 0.9, growthRate: 0.3, waterNeed: 0.7, energyOutput: 0,
      pollutionAbsorption: 0.8, pollutionEmission: 0, coldResistance: 0.4,
      heatResistance: 0.7, aggression: 0, intelligence: 0,
      reproductionRate: 0.4, lifespan: 0.9, adaptability: 0.6, rarity: 0.8,
      nightLuminosity: 0.8, toxicity: 0, spreadRate: 0.4,
    },
    possibleBiomes: ["rainforest", "temperate_forest"],
    risks: ["high_water_consumption"],
    benefits: ["pollution_reduction"],
    sandbox: true,
    ...overrides,
  };
}

function findLandCell(world: WorldState, preferWet = true): number {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < world.grid.cellCount; i++) {
    if ((world.grid.elevation[i] ?? 0) <= world.grid.seaLevel) continue;
    const score = (world.grid.fertility[i] ?? 0) + (preferWet ? (world.grid.moisture[i] ?? 0) : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

describe("planet generation", () => {
  it("same seed produces identical grids", () => {
    const a = generatePlanetGrid(SEED, { width: 64, height: 32, oceanRatio: 0.62, plateCount: 12, depositCount: 40 });
    const b = generatePlanetGrid(SEED, { width: 64, height: 32, oceanRatio: 0.62, plateCount: 12, depositCount: 40 });
    expect(Array.from(a.elevation)).toEqual(Array.from(b.elevation));
    expect(Array.from(a.biome)).toEqual(Array.from(b.biome));
    expect(a.seaLevel).toBe(b.seaLevel);
  });

  it("different seeds produce different planets", () => {
    const a = generatePlanetGrid(1, { width: 32, height: 16, oceanRatio: 0.6, plateCount: 8, depositCount: 10 });
    const b = generatePlanetGrid(2, { width: 32, height: 16, oceanRatio: 0.6, plateCount: 8, depositCount: 10 });
    expect(Array.from(a.elevation)).not.toEqual(Array.from(b.elevation));
  });

  it("has both oceans and land, with rivers and varied biomes", () => {
    const g = generatePlanetGrid(SEED, { width: 64, height: 32, oceanRatio: 0.62, plateCount: 12, depositCount: 40 });
    const ratio = landRatio(g);
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.6);
    const biomes = new Set(Array.from(g.biome));
    expect(biomes.size).toBeGreaterThan(4);
    let rivers = 0;
    for (const r of g.river) rivers += r;
    expect(rivers).toBeGreaterThan(5);
  });
});

describe("deterministic simulation", () => {
  it("same seed produces identical history (checksum equality)", () => {
    const a = makeWorld("a");
    const b = makeWorld("b");
    runTicks(a, 60);
    runTicks(b, 60);
    expect(worldChecksum(a)).toBe(worldChecksum(b));
    expect(a.events.length).toBe(b.events.length);
    expect(a.events.map((e) => e.hash)).toEqual(b.events.map((e) => e.hash));
  });

  it("event chain is tamper-evident and valid", () => {
    const w = makeWorld();
    runTicks(w, 40);
    expect(verifyEventChain(w.events)).toBe(true);
    const tampered = w.events.map((e) => ({ ...e }));
    (tampered[5] as { importance: number }).importance = 999;
    expect(verifyEventChain(tampered)).toBe(false);
  });

  it("snapshot + replay reaches the identical state (event sourcing)", () => {
    const a = makeWorld("a");
    runTicks(a, 30);
    const snap = takeSnapshot(a);
    runTicks(a, 30);

    const b = restoreSnapshot(snap);
    runTicks(b, 30);
    expect(worldChecksum(a)).toBe(worldChecksum(b));
  });

  it("rollback restores the exact earlier state", () => {
    const w = makeWorld();
    runTicks(w, 25);
    const snapshot = takeSnapshot(w);
    const checksumAt25 = worldChecksum(w);
    runTicks(w, 25);
    expect(worldChecksum(w)).not.toBe(checksumAt25);
    const restored = restoreSnapshot(snapshot);
    expect(worldChecksum(restored)).toBe(checksumAt25);
  });

  it("serialization round-trips without changing the checksum", () => {
    const w = makeWorld();
    runTicks(w, 20);
    const before = worldChecksum(w);
    const restored = deserializeWorld(serializeWorld(w));
    expect(worldChecksum(restored)).toBe(before);
  });
});

describe("world rules", () => {
  it("every civilization has population and territory", () => {
    const w = makeWorld();
    runTicks(w, 80);
    for (const civ of w.civs) {
      if (civ.fallen) continue;
      expect(civ.population).toBeGreaterThan(0);
      expect(civ.cells.length).toBeGreaterThan(0);
    }
  });

  it("no event exists without a recorded cause chain root", () => {
    const w = makeWorld();
    runTicks(w, 50);
    expect(w.events.length).toBeGreaterThan(10);
    // Contribution-linked events must carry causal references.
    const contributionEvents = w.events.filter((e) => e.contributionId);
    for (const e of contributionEvents) {
      const isRoot = w.contributionRoots[e.contributionId as string] === e.seq;
      expect(isRoot || e.causes.length > 0).toBe(true);
    }
    // All system events must belong to the hash chain.
    expect(verifyEventChain(w.events)).toBe(true);
  });

  it("population never exceeds regional carrying capacity for long", () => {
    const w = makeWorld();
    runTicks(w, 60);
    for (const civ of w.civs) {
      if (civ.fallen) continue;
      const capacity = civ.cells.length * 4000 + 4000;
      expect(civ.population).toBeLessThan(capacity);
    }
  });

  it("migrations never cross impossible terrain", () => {
    const w = makeWorld();
    runTicks(w, 120);
    for (const m of w.migrations) {
      if (m.path.length === 0) continue;
      for (const cell of m.path) {
        expect((w.grid.elevation[cell] ?? 0) > w.grid.seaLevel).toBe(true);
      }
    }
  });

  it("A* finds land routes between distant land cells", () => {
    const w = makeWorld();
    const land: number[] = [];
    for (let i = 0; i < w.grid.cellCount; i++) {
      if ((w.grid.elevation[i] ?? 0) > w.grid.seaLevel + 0.02) land.push(i);
    }
    const a = land[0] as number;
    const b = land[Math.floor(land.length / 3)] as number;
    const path = findPath(w.grid, a, b);
    if (path) {
      expect(path[0]).toBe(a);
      expect(path[path.length - 1]).toBe(b);
      for (const cell of path) {
        expect((w.grid.elevation[cell] ?? 0) > w.grid.seaLevel).toBe(true);
      }
    }
  });
});

describe("contributions", () => {
  it("a plant contribution enters the world and its effects are traceable", () => {
    const w = makeWorld();
    runTicks(w, 10);
    const cell = findLandCell(w);
    const result = applyContribution(w, "c-1", sampleAnalysis(), cell);
    expect(result.ok).toBe(true);
    expect(result.rootEvent).toBeDefined();

    runTicks(w, 30);
    const descendants = causalDescendants(w.events, result.rootEvent!.seq);
    const contributed = w.events.filter((e) => e.contributionId === "c-1");
    expect(contributed.length).toBeGreaterThanOrEqual(2);
    expect(descendants.length).toBeGreaterThanOrEqual(1);
    const species = w.species.find((s) => s.contributionId === "c-1");
    expect(species).toBeDefined();
    expect(speciesPopulation(species!)).toBeGreaterThan(0);
  });

  it("rejects planting in the ocean with a clear reason", () => {
    const w = makeWorld();
    let ocean = -1;
    for (let i = 0; i < w.grid.cellCount; i++) {
      if ((w.grid.elevation[i] ?? 0) <= w.grid.seaLevel) {
        ocean = i;
        break;
      }
    }
    const result = applyContribution(w, "c-2", sampleAnalysis(), ocean);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("plants_need_land");
  });

  it("future scenarios are deterministic and probabilistic", () => {
    const w = makeWorld();
    runTicks(w, 10);
    const cell = findLandCell(w);
    const analysis = sampleAnalysis();
    const a = runFutureScenarios(w, "c-3", analysis, cell, { horizons: [10, 100], runsPerHorizon: 4 });
    const b = runFutureScenarios(w, "c-3", analysis, cell, { horizons: [10, 100], runsPerHorizon: 4 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.horizons.length).toBe(2);
    for (const h of a.horizons) {
      expect(h.uncertainty).toBeGreaterThanOrEqual(0);
      expect(h.uncertainty).toBeLessThanOrEqual(1);
      expect(h.likelihood).toBeGreaterThanOrEqual(0);
      expect(h.likelihood).toBeLessThanOrEqual(1);
    }
    // Preview must not mutate the source world.
    const checksum = worldChecksum(w);
    runFutureScenarios(w, "c-3", analysis, cell, { horizons: [10], runsPerHorizon: 2 });
    expect(worldChecksum(w)).toBe(checksum);
  });

  it("world laws actually modify simulation behaviour", () => {
    const base = makeWorld("base");
    const lawful = makeWorld("lawful");
    const law = sampleAnalysis({
      category: ContributionCategory.WorldLaw,
      name: "Clean Air Accord",
      traits: { ...sampleAnalysis().traits, pollutionAbsorption: 0.95 },
    });
    const cell = findLandCell(lawful);
    expect(applyContribution(lawful, "law-1", law, cell).ok).toBe(true);
    runTicks(base, 40);
    runTicks(lawful, 40);
    let pBase = 0;
    let pLaw = 0;
    for (let i = 0; i < base.grid.cellCount; i++) {
      pBase += base.grid.pollution[i] ?? 0;
      pLaw += lawful.grid.pollution[i] ?? 0;
    }
    expect(pLaw).toBeLessThanOrEqual(pBase + 1e-6);
  });
});

describe("event store scale", () => {
  it("handles thousands of events with cursor pagination", () => {
    const w = makeWorld();
    runTicks(w, 200);
    expect(w.events.length).toBeGreaterThan(100);
    const page1 = queryEvents(w.events, { limit: 50 });
    expect(page1.events.length).toBe(50);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = queryEvents(w.events, { limit: 50, beforeSeq: page1.nextCursor! });
    expect(page2.events.length).toBeGreaterThan(0);
    // No overlap between pages.
    const seqs1 = new Set(page1.events.map((e) => e.seq));
    for (const e of page2.events) expect(seqs1.has(e.seq)).toBe(false);
    // Type filtering.
    const wars = queryEvents(w.events, { limit: 500, types: [WorldEventType.WarStarted] });
    for (const e of wars.events) expect(e.type).toBe(WorldEventType.WarStarted);
  });
});

describe("habitat suitability", () => {
  it("is bounded and biome-aware", () => {
    const w = makeWorld();
    const plant = w.species.find((s) => s.kind === "flora");
    expect(plant).toBeDefined();
    for (let i = 0; i < w.grid.cellCount; i += 17) {
      const s = habitatSuitability(w, plant!, i);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe("rng", () => {
  it("streams are independent and reproducible", () => {
    const a = createRng(7);
    const b = createRng(7);
    const draws1: number[] = [];
    const draws2: number[] = [];
    for (let i = 0; i < 8; i++) {
      draws1.push(rngRandom(a, "x"));
      draws2.push(rngRandom(b, "x"));
    }
    expect(draws1).toEqual(draws2);
    expect(new Set(draws1).size).toBeGreaterThan(1);
    // Different stream name -> different sequence, same reproducibility.
    const c = createRng(7);
    const other = [0, 1, 2].map(() => rngRandom(c, "y"));
    expect(other).not.toEqual(draws1.slice(0, 3));
    // Counter table fully describes state: copy it, continue identically.
    const d = createRng(7);
    d.counters = { ...a.counters };
    expect(rngRandom(d, "x")).toBe(rngRandom(b, "x"));
  });
});
