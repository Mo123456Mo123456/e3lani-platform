import { describe, expect, it } from "vitest";
import { SimulationEngine } from "./engine.js";

/**
 * Long-run structural invariants: whatever happens over a millennium of wars,
 * collapses and plagues, the world's bookkeeping must stay consistent.
 */
describe("long-run world invariants", () => {
  it("holds across 3 seeds × 600 ticks", () => {
    for (const seed of ["inv-a", "inv-b", "inv-c"]) {
      const e = SimulationEngine.create(seed, { gridWidth: 64, gridHeight: 32, snapshotInterval: 100 });
      e.runTicks(600);
      const s = e.state;

      for (const civ of s.civs.values()) {
        // every referenced city exists and points back consistently
        for (const cityId of civ.cityIds) {
          const city = s.cities.get(cityId);
          expect(city, `civ ${civ.id} references missing city ${cityId}`).toBeTruthy();
          expect(city!.civId, `city ${cityId} owned by ${city!.civId} but listed by ${civ.id}`).toBe(civ.id);
        }
        // capital invariant
        if (civ.capitalCityId) expect(s.cities.has(civ.capitalCityId)).toBe(true);
        // territory ownership is consistent with cell owners
        for (const idx of civ.territory) {
          expect(s.cells[idx]!.ownerCivId).toBe(civ.id);
        }
      }

      // no cell owned by a missing civ; no city on a cell without back-reference
      for (const cell of s.cells) {
        if (cell.ownerCivId) {
          const owner = s.civs.get(cell.ownerCivId);
          expect(owner, `cell ${cell.index} owned by missing civ`).toBeTruthy();
        }
        if (cell.cityId) {
          expect(s.cities.has(cell.cityId)).toBe(true);
        }
      }

      // active wars reference living civs
      for (const war of s.wars.values()) {
        if (war.status !== "active") continue;
        expect(s.civs.get(war.attackerCivId)?.extinct).not.toBe(true);
        expect(s.civs.get(war.defenderCivId)?.extinct).not.toBe(true);
      }

      // population accounting never goes negative
      for (const civ of s.civs.values()) {
        expect(civ.population).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(civ.stability)).toBe(true);
      }
    }
  }, 300_000);
});
