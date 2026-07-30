import { describe, expect, it } from "vitest";
import {
  SeededRandom,
  generatePlanet,
  SimulationEngine,
  analyzeContributionHeuristic,
  resetEventCounter,
} from "../src/index.js";

describe("SeededRandom determinism", () => {
  it("same seed yields same sequence", () => {
    const a = new SeededRandom("planet-test");
    const b = new SeededRandom("planet-test");
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = new SeededRandom("a");
    const b = new SeededRandom("b");
    expect(a.next()).not.toEqual(b.next());
  });
});

describe("World generator", () => {
  it("same seed produces identical biome map", () => {
    const p1 = generatePlanet("seed-xyz", 32);
    const p2 = generatePlanet("seed-xyz", 32);
    expect(p1.biomeMap).toEqual(p2.biomeMap);
    expect([...p1.heightMap]).toEqual([...p2.heightMap]);
    expect(p1.regions.length).toBeGreaterThan(10);
  });

  it("classifies oceans and land", () => {
    const p = generatePlanet("seed-xyz", 32);
    const oceans = p.cells.filter((c) => c.biome === "ocean").length;
    const land = p.cells.length - oceans;
    expect(oceans).toBeGreaterThan(0);
    expect(land).toBeGreaterThan(0);
  });
});

describe("Simulation engine", () => {
  it("same seed + ticks reproduces history", () => {
    resetEventCounter(0);
    const planet = generatePlanet("sim-seed", 24);
    const e1 = new SimulationEngine("sim-seed", planet.regions, -100);
    e1.bootstrapInitialWorld({
      civilizations: 4,
      citiesPerCiv: 2,
      species: 10,
      plants: 10,
      resources: 20,
      technologies: 5,
    });
    for (let i = 0; i < 5; i++) e1.tick(1);
    const snap1 = e1.getPublicState();

    resetEventCounter(0);
    const e2 = new SimulationEngine("sim-seed", planet.regions, -100);
    e2.bootstrapInitialWorld({
      civilizations: 4,
      citiesPerCiv: 2,
      species: 10,
      plants: 10,
      resources: 20,
      technologies: 5,
    });
    for (let i = 0; i < 5; i++) e2.tick(1);
    const snap2 = e2.getPublicState();

    expect(snap1.year).toEqual(snap2.year);
    expect(snap1.stats.civilizations).toEqual(snap2.stats.civilizations);
    expect(snap1.civilizations.map((c) => c.population)).toEqual(
      snap2.civilizations.map((c) => c.population),
    );
  });

  it("rollback restores snapshot", () => {
    const planet = generatePlanet("rb-seed", 24);
    const eng = new SimulationEngine("rb-seed", planet.regions, 0);
    eng.bootstrapInitialWorld({
      civilizations: 3,
      citiesPerCiv: 2,
      species: 5,
      plants: 5,
      resources: 10,
      technologies: 3,
    });
    const t0 = eng.state.tick;
    eng.takeSnapshot();
    const pop0 = [...eng.state.civilizations.values()][0]!.population;
    for (let i = 0; i < 8; i++) eng.tick(1);
    expect(eng.rollbackTo(t0)).toBe(true);
    expect(eng.state.tick).toBe(t0);
    expect([...eng.state.civilizations.values()][0]!.population).toBe(pop0);
  });

  it("no civilization without population", () => {
    const planet = generatePlanet("civ-seed", 24);
    const eng = new SimulationEngine("civ-seed", planet.regions, 0);
    eng.bootstrapInitialWorld({ civilizations: 5, citiesPerCiv: 2, species: 5, plants: 5, resources: 10, technologies: 2 });
    for (const c of eng.state.civilizations.values()) {
      expect(c.population).toBeGreaterThan(0);
      expect(c.cityIds.length).toBeGreaterThan(0);
    }
  });

  it("events always have a cause", () => {
    const planet = generatePlanet("evt-seed", 24);
    const eng = new SimulationEngine("evt-seed", planet.regions, 0);
    eng.bootstrapInitialWorld({ civilizations: 4, citiesPerCiv: 2, species: 8, plants: 8, resources: 15, technologies: 4 });
    for (let i = 0; i < 15; i++) eng.tick(1);
    for (const e of eng.events.all()) {
      expect(e.cause).toBeTruthy();
    }
  });

  it("applies user plant contribution with causal chain", () => {
    const planet = generatePlanet("contrib-seed", 24);
    const eng = new SimulationEngine("contrib-seed", planet.regions, 0);
    eng.bootstrapInitialWorld({ civilizations: 3, citiesPerCiv: 2, species: 5, plants: 5, resources: 10, technologies: 2 });
    const region = [...eng.state.regions.values()].find((r) => r.biome !== "ocean")!;
    const element = analyzeContributionHeuristic(
      "أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل.",
      "plant",
    );
    const { events } = eng.applyContribution(element, region.id, "contrib_test_1");
    expect(events.some((e) => e.type === "USER_CONTRIBUTION")).toBe(true);
    expect(events.some((e) => e.type === "PLANT_CREATED")).toBe(true);
    expect(eng.events.edgesAll().length).toBeGreaterThan(0);
  });

  it("rejects overpowered patterns via balance", () => {
    const el = analyzeContributionHeuristic(
      "مخلوق خالد لا يموت ويتكاثر بلا حدود ويدمر الكوكب",
      "creature",
    );
    expect(el.balanceNotes.length).toBeGreaterThan(0);
    expect(el.traits.reproduction ?? 1).toBeLessThanOrEqual(0.7);
  });

  it("population respects carrying capacity pressure", () => {
    const planet = generatePlanet("cap-seed", 24);
    const eng = new SimulationEngine("cap-seed", planet.regions, 0);
    eng.bootstrapInitialWorld({ civilizations: 2, citiesPerCiv: 1, species: 3, plants: 3, resources: 5, technologies: 1 });
    for (let i = 0; i < 30; i++) eng.tick(1);
    for (const civ of eng.state.civilizations.values()) {
      const cap = civ.regionIds.reduce(
        (a, id) => a + (eng.state.regions.get(id)?.carryingCapacity ?? 1000),
        0,
      );
      // Soft bound: may slightly exceed but not explode unboundedly
      expect(civ.population).toBeLessThan(cap * 3);
    }
  });
});
