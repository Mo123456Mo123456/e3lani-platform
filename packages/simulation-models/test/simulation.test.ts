import { describe, expect, it } from "vitest";

import {
  advanceTicks,
  generateWorld,
  initializeSimulation,
  projectFutureScenarios,
  replay,
  simulateContribution,
} from "../src/index.js";
import type {
  ContributionInput,
  SimulationEvent,
  WorldState,
} from "@kawkab/shared-types";

function habitableRegion(state: WorldState): WorldState["regions"][number] {
  const region = state.regions.find(
    (candidate) =>
      candidate.carryingCapacity > 100_000 &&
      !["OCEAN", "ICE", "MOUNTAIN"].includes(candidate.biome),
  );
  if (!region) throw new Error("Test world has no suitable habitable region");
  return region;
}

describe("deterministic simulation core", () => {
  it("generates exactly the same world from the same seed", () => {
    const first = generateWorld("كوكب-42", { rows: 8, columns: 16 });
    const second = generateWorld("كوكب-42", { rows: 8, columns: 16 });
    const different = generateWorld("كوكب-43", { rows: 8, columns: 16 });

    expect(second).toEqual(first);
    expect(different.regions).not.toEqual(first.regions);
  });

  it("replays the event log to exactly the same state", () => {
    const initialized = initializeSimulation("replay-seed", {
      rows: 8,
      columns: 16,
    });
    const region = habitableRegion(initialized.state);
    const contribution = simulateContribution(initialized.state, {
      id: "replay-civilization",
      kind: "CIVILIZATION",
      submittedAtTick: 0,
      name: { ar: "حضارة الاختبار", en: "Test Civilization" },
      regionId: region.id,
      foundingPopulation: 25_000,
      technologyLevel: 0.3,
      stability: 0.8,
    });
    const advanced = advanceTicks(contribution.state, 8);
    const log = [
      ...initialized.events,
      ...contribution.events,
      ...advanced.events,
    ];

    expect(replay(log)).toEqual(advanced.state);
  });

  it("gives every generated event a cause and a traceable causal link", () => {
    const initialized = initializeSimulation("causes-seed", {
      rows: 6,
      columns: 12,
    });
    const region = habitableRegion(initialized.state);
    const contribution = simulateContribution(initialized.state, {
      id: "causal-plant",
      kind: "PLANT",
      submittedAtTick: 0,
      name: { ar: "نبات سببي", en: "Causal plant" },
      regionId: region.id,
      resilience: 0.8,
      growthRate: 0.6,
      nutrition: 0.7,
      invasiveness: 0.1,
    });
    const tick = advanceTicks(contribution.state, 2);
    const events: SimulationEvent[] = [
      ...initialized.events,
      ...contribution.events,
      ...tick.events,
    ];
    const links = [...contribution.causalLinks, ...tick.causalLinks];

    expect(events.every((event) => event.causes.length > 0)).toBe(true);
    for (const event of events.slice(1)) {
      expect(links.some((link) => link.targetEventId === event.id)).toBe(true);
    }
    expect(
      contribution.causalLinks.some(
        (link) => link.relationship === "SECONDARY",
      ),
    ).toBe(true);
  });

  it("bounds all contribution effects and population by carrying capacity", () => {
    let state = generateWorld("bounded-seed", { rows: 8, columns: 16 });
    const region = habitableRegion(state);
    const startingCapacity = region.carryingCapacity;
    const inputs: ContributionInput[] = [
      {
        id: "bounded-plant",
        kind: "PLANT",
        submittedAtTick: 0,
        name: { ar: "نبات", en: "Plant" },
        regionId: region.id,
        resilience: 1,
        growthRate: 1,
        nutrition: 1,
        invasiveness: 0,
      },
      {
        id: "bounded-resource",
        kind: "RESOURCE",
        submittedAtTick: 0,
        name: { ar: "معدن", en: "Mineral" },
        regionId: region.id,
        resourceKind: "MINERAL",
        abundance: 0.9,
        renewability: 0,
        strategicValue: 1,
        pollutionRisk: 1,
      },
      {
        id: "bounded-species",
        kind: "SPECIES",
        submittedAtTick: 0,
        name: { ar: "نوع", en: "Species" },
        regionId: region.id,
        trophicLevel: "OMNIVORE",
        adaptability: 1,
        reproductionRate: 1,
        ecologicalImpact: -1,
      },
      {
        id: "bounded-civilization",
        kind: "CIVILIZATION",
        submittedAtTick: 0,
        name: { ar: "حضارة", en: "Civilization" },
        regionId: region.id,
        foundingPopulation: startingCapacity * 10,
        technologyLevel: 0.5,
        stability: 0.5,
      },
      {
        id: "bounded-technology",
        kind: "TECHNOLOGY",
        submittedAtTick: 0,
        name: { ar: "تقنية", en: "Technology" },
        regionId: region.id,
        civilizationId: "civilization:bounded-civilization",
        domain: "ENERGY",
        effectiveness: 1,
        pollutionEffect: 1,
        populationEffect: 1,
      },
    ];

    for (const input of inputs) {
      const before = JSON.stringify(state);
      const result = simulateContribution(state, input);
      expect(result.analysis.accepted).toBe(true);
      expect(result.analysis.projection.pollutionDelta).toBeGreaterThanOrEqual(-1);
      expect(result.analysis.projection.pollutionDelta).toBeLessThanOrEqual(1);
      expect(result.analysis.projection.biodiversityDelta).toBeGreaterThanOrEqual(-1);
      expect(result.analysis.projection.biodiversityDelta).toBeLessThanOrEqual(1);
      expect(JSON.stringify(state)).toBe(before);
      state = result.state;
      for (const changedRegion of state.regions) {
        expect(changedRegion.population).toBeLessThanOrEqual(
          changedRegion.carryingCapacity,
        );
        expect(changedRegion.pollution).toBeGreaterThanOrEqual(0);
        expect(changedRegion.pollution).toBeLessThanOrEqual(1);
      }
    }

    const finalRegion = state.regions.find(({ id }) => id === region.id);
    expect(finalRegion?.carryingCapacity).toBeLessThan(startingCapacity * 1.5);
  });

  it("produces deterministic bounded Monte Carlo scenarios", () => {
    const initialized = initializeSimulation("future-seed", {
      rows: 6,
      columns: 12,
    });
    const region = habitableRegion(initialized.state);
    const founded = simulateContribution(initialized.state, {
      id: "future-civilization",
      kind: "CIVILIZATION",
      submittedAtTick: 0,
      name: { ar: "حضارة المستقبل", en: "Future Civilization" },
      regionId: region.id,
      foundingPopulation: 20_000,
      technologyLevel: 0.4,
      stability: 0.7,
    });
    const options = { horizonTicks: 24, runs: 21, seed: "projection-seed" };

    const first = projectFutureScenarios(founded.state, options);
    const second = projectFutureScenarios(founded.state, options);

    expect(second).toEqual(first);
    expect(first.worst.score).toBeLessThanOrEqual(first.likely.score);
    expect(first.likely.score).toBeLessThanOrEqual(first.best.score);
    expect(first.uncertainty.population.low).toBeLessThanOrEqual(
      first.uncertainty.population.high,
    );
  });
});
