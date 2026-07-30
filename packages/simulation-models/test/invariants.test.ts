/**
 * Property-style invariants over many seeded runs: the simulated world must
 * never violate its own physics, regardless of seed.
 */
import { describe, expect, it } from "vitest";
import { worldEventSchema } from "@planet/validation";
import { SimulationEngine } from "../src/index";

const SEEDS = ["inv-1", "inv-2", "inv-3", "inv-4", "inv-5", "inv-6"];

describe("world invariants hold for any seed", () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: 90 ticks with valid state & events`, () => {
      const engine = SimulationEngine.genesis({ seed, planetId: "p" });
      engine.run(90);
      const { state } = engine;

      // populations are finite and non-negative
      for (const s of state.species) {
        expect(Number.isFinite(s.population)).toBe(true);
        expect(s.population).toBeGreaterThanOrEqual(0);
      }
      for (const c of state.civs) {
        expect(Number.isFinite(c.population)).toBe(true);
        expect(c.population).toBeGreaterThanOrEqual(0);
        expect(c.stability).toBeGreaterThanOrEqual(0);
        expect(c.stability).toBeLessThanOrEqual(1);
      }

      // every journal entry is schema-valid and causally explained
      for (const event of engine.journal) {
        const parsed = worldEventSchema.safeParse(event);
        expect(parsed.success, `invalid event ${event.id}: ${JSON.stringify(parsed.error?.issues ?? {})}`).toBe(true);
        expect(event.cause.length).toBeGreaterThan(0);
      }

      // wars only between existing civilizations
      const civIds = new Set(state.civs.map((c) => c.id));
      for (const war of state.wars) {
        expect(civIds.has(war.attackerCivId)).toBe(true);
        expect(civIds.has(war.defenderCivId)).toBe(true);
      }

      // cities sit on land, trade routes only cross allowed terrain
      for (const city of state.cities) {
        expect(state.grid.cells[city.cell]!.height).toBeGreaterThanOrEqual(state.grid.seaLevel);
      }
      for (const route of state.tradeRoutes) {
        for (const cell of route.path) {
          const biome = state.grid.cells[cell]!.biome;
          expect(biome === "ocean" ? state.grid.cells[cell]!.height >= state.grid.seaLevel : true).toBe(true);
        }
      }

      // species never exceed a generous multiple of their carrying capacity
      for (const s of state.species) {
        if (s.extinctAtTick) continue;
        expect(s.population).toBeLessThan(50000);
      }
    });
  }

  it("no civilization exists without territory and population", () => {
    const engine = SimulationEngine.genesis({ seed: "civ-integrity" });
    engine.run(120);
    const owners = new Set<string>();
    for (const cell of engine.state.grid.cells) if (cell.ownerId) owners.add(cell.ownerId);
    for (const civ of engine.state.civs) {
      if (civ.collapsedAtTick !== null) continue;
      expect(civ.population).toBeGreaterThan(0);
      expect(owners.has(civ.id), `civ ${civ.name} alive without territory`).toBe(true);
    }
  });

  it("terrestrial species never occupy ocean cells", () => {
    const engine = SimulationEngine.genesis({ seed: "habitat-integrity" });
    engine.run(120);
    for (const s of engine.state.species) {
      if (s.traits.aquatic) continue;
      for (const cell of s.habitat) {
        expect(
          engine.state.grid.cells[cell]!.height,
          `terrestrial species ${s.name} in ocean cell ${cell}`,
        ).toBeGreaterThanOrEqual(engine.state.grid.seaLevel);
      }
    }
  });
});
