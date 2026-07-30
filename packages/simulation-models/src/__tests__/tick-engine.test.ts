import { describe, expect, it } from "vitest";
import { SimulationTickEngine } from "../tick-engine.js";

describe("SimulationTickEngine", () => {
  it("is deterministic: same seed yields same history", () => {
    const a = new SimulationTickEngine("sim-seed", "year", 16);
    const b = new SimulationTickEngine("sim-seed", "year", 16);
    a.runTicks(5);
    b.runTicks(5);
    const eventsA = a.getEvents().map((e) => ({ type: e.type, tick: e.tick, payload: e.payload }));
    const eventsB = b.getEvents().map((e) => ({ type: e.type, tick: e.tick, payload: e.payload }));
    expect(eventsA).toEqual(eventsB);
    expect(a.getState().species.map((s) => Math.round(s.population))).toEqual(
      b.getState().species.map((s) => Math.round(s.population)),
    );
  });

  it("rebuildFromEvents restores equivalent state", () => {
    const eng = new SimulationTickEngine("rebuild-seed", "year", 16);
    eng.runTicks(4);
    const events = eng.getEvents().map((e) => structuredClone(e));
    const state = eng.getState();

    const rebuilt = eng.rebuildFromEvents(events);
    expect(rebuilt.tick).toEqual(state.tick);
    expect(rebuilt.species.map((s) => ({ id: s.id, pop: Math.round(s.population) }))).toEqual(
      state.species.map((s) => ({ id: s.id, pop: Math.round(s.population) })),
    );
    expect(rebuilt.civilizations.map((c) => ({ id: c.id, pop: Math.round(c.population) }))).toEqual(
      state.civilizations.map((c) => ({ id: c.id, pop: Math.round(c.population) })),
    );
  });

  it("no event without cause except genesis", () => {
    const eng = new SimulationTickEngine("cause-seed", "year", 16);
    eng.injectUserElement({
      contributionId: "c1",
      category: "creature",
      title: "Sky Ray",
      traits: { size: 0.4, strength: 0.3 },
    });
    eng.runTicks(3);
    for (const e of eng.getEvents()) {
      if (e.type === "GENESIS") {
        expect(e.causeIds).toEqual([]);
      } else {
        expect(e.causeIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps populations within carrying capacity", () => {
    const eng = new SimulationTickEngine("cap-seed", "year", 16);
    eng.runTicks(20);
    for (const sp of eng.getState().species) {
      expect(sp.population).toBeLessThanOrEqual(sp.carryingCapacity * 1.05 + 1e-6);
    }
  });

  it("snapshot and restore round-trip", () => {
    const eng = new SimulationTickEngine("snap-seed", "year", 16);
    eng.runTicks(2);
    const snap = eng.snapshot();
    eng.runTicks(3);
    expect(eng.getTick()).toBeGreaterThan(snap.tick);
    eng.restore();
    expect(eng.getTick()).toEqual(snap.tick);
  });
});
