import { describe, expect, it } from "vitest";
import { createWorld, runTicks, worldChecksum } from "@planet/simulation-models";

describe("world generation service core", () => {
  it("generates a complete populated world from any seed", () => {
    const world = createWorld({ worldId: "gen-test", name: "Gen", seed: 999, yearsPerTick: 1, plantSpecies: 100, animalSpecies: 40, civilizations: 4 });
    runTicks(world, 20);
    expect(world.events.length).toBeGreaterThan(4);
    expect(world.civs.length).toBeGreaterThan(0);
    expect(world.deposits.length).toBeGreaterThan(0);
    const again = createWorld({ worldId: "gen-test", name: "Gen", seed: 999, yearsPerTick: 1, plantSpecies: 100, animalSpecies: 40, civilizations: 4 });
    runTicks(again, 20);
    expect(worldChecksum(world)).toBe(worldChecksum(again));
  });
});
