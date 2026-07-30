import { describe, expect, it } from "vitest";
import { checksum } from "@kawkab/simulation-models";
import { canFoundCivilization, createInitialState, replayEvents, runTicks } from "../src/index";

describe("deterministic simulation core", () => {
  it("same seed produces same history", () => {
    const a = runTicks({ seed: "same-seed", resolution: 10 }, 8);
    const b = runTicks({ seed: "same-seed", resolution: 10 }, 8);
    expect(checksum(a.events)).toEqual(checksum(b.events));
  });

  it("event replay restores state", () => {
    const state = runTicks({ seed: "replay-seed", resolution: 10 }, 6);
    const replayed = replayEvents({ seed: "replay-seed", resolution: 10 }, state.events);
    expect(checksum({ species: replayed.species, civilizations: replayed.civilizations, cities: replayed.cities, tick: replayed.tick })).toEqual(
      checksum({ species: state.species, civilizations: state.civilizations, cities: state.cities, tick: state.tick })
    );
  });

  it("does not found civilization without resources and population", () => {
    const state = createInitialState({ seed: "poor-world", resolution: 8 });
    const region = state.planet.regions[0]!;
    for (const species of Object.values(state.species)) species.population = 0;
    for (const key of Object.keys(state.resources)) delete state.resources[key];
    expect(canFoundCivilization(state, region.id)).toBe(false);
  });

  it("keeps population under carrying capacity", () => {
    const state = runTicks({ seed: "capacity-seed", resolution: 12 }, 20);
    for (const species of Object.values(state.species)) {
      expect(species.population).toBeLessThanOrEqual(species.carryingCapacity);
    }
  });
});
