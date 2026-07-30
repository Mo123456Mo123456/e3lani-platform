import { describe, expect, it } from "vitest";
import { SimulationEngine } from "../src/index";
import { fingerprint } from "../src/rng";

describe("event sourcing & replay", () => {
  it("rollback + replay reproduces the exact state", () => {
    const fresh = SimulationEngine.genesis({ seed: "replay-seed", planetId: "p", snapshotInterval: 10 });
    fresh.run(160);
    const target = fresh.fingerprint();

    const rolled = SimulationEngine.genesis({ seed: "replay-seed", planetId: "p", snapshotInterval: 10 });
    rolled.run(200); // go past the target
    expect(rolled.rollbackTo(160).ok).toBe(true);
    expect(rolled.state.tick).toBe(160);
    expect(rolled.fingerprint()).toBe(target);
  });

  it("replayed journal matches the original journal", () => {
    const a = SimulationEngine.genesis({ seed: "replay-journal", planetId: "p", snapshotInterval: 10 });
    a.run(120);
    const journalHash = fingerprint(a.journal);

    const b = SimulationEngine.genesis({ seed: "replay-journal", planetId: "p", snapshotInterval: 10 });
    b.run(180);
    b.rollbackTo(120);
    expect(fingerprint(b.journal)).toBe(journalHash);
  });

  it("snapshots are available at configured intervals", () => {
    const engine = SimulationEngine.genesis({ seed: "snapshots", snapshotInterval: 25 });
    engine.run(60);
    const snaps = engine.availableSnapshots();
    expect(snaps).toContain(0);
    expect(snaps).toContain(25);
    expect(snaps).toContain(50);
  });

  it("rejects rollback to the future", () => {
    const engine = SimulationEngine.genesis({ seed: "rollback-guard" });
    engine.run(10);
    expect(engine.rollbackTo(50).ok).toBe(false);
  });
});
