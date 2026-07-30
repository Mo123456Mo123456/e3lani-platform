import { describe, expect, it } from "vitest";
import {
  generateWorld,
  replayEvents,
  simulateTick,
  stateChecksum,
} from "../src";

describe("deterministic world simulation", () => {
  it("generates the same world from the same seed", () => {
    const left = generateWorld("azura-prime", { regionCount: 80 });
    const right = generateWorld("azura-prime", { regionCount: 80 });

    expect(stateChecksum(left)).toBe(stateChecksum(right));
    expect(left.civilizations).toHaveLength(12);
    expect(left.species.filter((species) => species.kind === "plant")).toHaveLength(800);
    expect(left.species.filter((species) => species.kind === "creature")).toHaveLength(300);
  });

  it("replays event history to the exact resulting state", () => {
    const initial = generateWorld("replayable-world", { regionCount: 72 });
    const result = simulateTick(initial);
    const replayed = replayEvents(initial, result.events);

    expect(stateChecksum(replayed)).toBe(stateChecksum(result.state));
    expect(replayed.tick).toBe(1);
  });

  it("never emits an unexplained event", () => {
    const initial = generateWorld("causal-world", { regionCount: 64 });
    const result = simulateTick(initial);

    for (const event of result.events) {
      expect(event.metadata.cause).toBeTypeOf("string");
      expect(event.confidence).toBeGreaterThan(0);
    }
  });

  it("keeps regional population within carrying capacity", () => {
    let state = generateWorld("bounded-population", { regionCount: 64 });
    let history: ReturnType<typeof simulateTick>["events"] = [];
    for (let index = 0; index < 25; index += 1) {
      const result = simulateTick(state, history);
      state = result.state;
      history = result.events;
    }

    for (const region of state.regions) {
      expect(region.population).toBeLessThanOrEqual(region.carryingCapacity);
      expect(region.population).toBeGreaterThanOrEqual(0);
    }
  });
});
