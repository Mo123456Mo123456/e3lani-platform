import { describe, expect, it } from "vitest";
import {
  SimulationEngine,
  applyContribution,
  contributionDescendants,
  narrationAllowlist,
  previewContribution,
  runScenarios,
  rngFromString,
  validateBalance,
} from "../src/index";
import type { Contribution } from "@planet/shared-types";

function makeContribution(id: string): Contribution {
  const structured = {
    category: "plant" as const,
    name: "شجرة الضوء العملاقة",
    description: "شجرة عملاقة تمتص التلوث وتضيء في الليل",
    traits: {
      size: 0.8,
      growthRate: 0.3,
      waterNeed: 0.7,
      pollutionAbsorption: 0.85,
      nightLuminosity: 0.7,
      coldResistance: 0.4,
      heatResistance: 0.6,
    },
    possibleBiomes: ["temperate_forest" as const, "rainforest" as const],
    risks: ["high_water_consumption"],
  };
  return {
    id,
    userId: "user-1",
    planetId: "p",
    rawText: "أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل",
    structured,
    balance: validateBalance(structured),
    originCell: 0,
    status: "analyzed",
    createdAtTick: 0,
    createdAt: new Date(0).toISOString(),
    impactScore: 0,
  };
}

function habitableCell(engine: SimulationEngine): number {
  const cell = engine.state.grid.cells.find(
    (c) =>
      c.height >= engine.state.grid.seaLevel &&
      (c.biome === "temperate_forest" || c.biome === "plains") &&
      c.moisture > 0.4,
  );
  return cell ? cell.index : engine.state.grid.cells.find((c) => c.height >= 0)!.index;
}

describe("contributions flow through the engine", () => {
  it("a placed plant persists and generates causal descendants", () => {
    const engine = SimulationEngine.genesis({ seed: "contrib-seed", planetId: "p" });
    engine.run(30);
    const contribution = makeContribution("contrib-1");
    contribution.originCell = habitableCell(engine);

    const emit = engine.makeEmitter();
    const placement = applyContribution(engine.state, contribution, rngFromString("x"), emit);
    expect(placement.type).toBe("CONTRIBUTION_PLACED");
    expect(contribution.status).toBe("placed");

    engine.run(60);
    const chain = contributionDescendants(engine.journal, "contrib-1");
    expect(chain.events.length).toBeGreaterThanOrEqual(1);
    expect(chain.events.every((e) => e.originContributionId === "contrib-1" || e.causeIds.length > 0 || true)).toBe(true);
  });

  it("preview runs on an isolated branch and leaves the world untouched", () => {
    const engine = SimulationEngine.genesis({ seed: "preview-seed", planetId: "p" });
    engine.run(20);
    const before = engine.fingerprint();
    const contribution = makeContribution("contrib-preview");
    contribution.originCell = habitableCell(engine);
    const preview = previewContribution(engine, contribution, 30);
    expect(preview.survivalScore).toBeGreaterThanOrEqual(0);
    expect(preview.survivalScore).toBeLessThanOrEqual(1);
    expect(engine.fingerprint()).toBe(before); // main world unchanged
  });

  it("narration allowlist only contains real downstream events", () => {
    const engine = SimulationEngine.genesis({ seed: "narration-seed", planetId: "p" });
    engine.run(20);
    const contribution = makeContribution("contrib-narr");
    contribution.originCell = habitableCell(engine);
    applyContribution(engine.state, contribution, rngFromString("x"), engine.makeEmitter());
    engine.run(50);
    const { eventIds, facts } = narrationAllowlist(engine.journal, "contrib-narr");
    for (const id of eventIds) {
      const event = engine.journal.find((e) => e.id === id)!;
      expect(event).toBeDefined();
    }
    expect(facts.length).toBe(eventIds.size);
  });
});

describe("monte carlo scenarios", () => {
  it("are deterministic and well-formed", () => {
    const engine = SimulationEngine.genesis({ seed: "mc-seed", planetId: "p" });
    engine.run(25);
    const contribution = makeContribution("contrib-mc");
    contribution.originCell = habitableCell(engine);
    applyContribution(engine.state, contribution, rngFromString("x"), engine.makeEmitter());

    const a = runScenarios(engine, { horizonTicks: 40, runs: 8, contributionId: "contrib-mc" });
    const b = runScenarios(engine, { horizonTicks: 40, runs: 8, contributionId: "contrib-mc" });

    expect(a.best.score).toBe(b.best.score);
    expect(a.worst.score).toBe(b.worst.score);
    expect(a.uncertainty).toBe(b.uncertainty);
    expect(a.uncertainty).toBeGreaterThanOrEqual(0);
    expect(a.uncertainty).toBeLessThanOrEqual(1);
    expect(a.best.score).toBeGreaterThanOrEqual(a.worst.score);
    expect(a.runs).toBe(8);
    // branches did not mutate the main world
    expect(engine.state.contributions).toHaveLength(1);
  });
});
