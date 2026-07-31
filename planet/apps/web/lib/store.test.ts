import { describe, expect, it } from "vitest";
import { WorldEventType, type WorldEvent } from "@planet/shared-types";
import { useEventsStore } from "./store";
import { EVENT_FEED_RING_BUFFER } from "@planet/config";

function fakeEvent(seq: number): WorldEvent {
  return {
    seq,
    tick: seq,
    year: seq,
    type: WorldEventType.PlantSpread,
    payload: {},
    causes: [],
    confidence: 1,
    importance: 0.2,
    hash: `h${seq}`,
  };
}

describe("events ring buffer (UI resilience at scale)", () => {
  it("absorbs tens of thousands of events in bounded memory", () => {
    const store = useEventsStore.getState();
    store.clear();
    const start = Date.now();
    for (let i = 1; i <= 20000; i++) {
      useEventsStore.getState().push(fakeEvent(i));
    }
    const elapsed = Date.now() - start;
    const state = useEventsStore.getState();
    expect(state.events.length).toBeLessThanOrEqual(EVENT_FEED_RING_BUFFER);
    expect(state.events[0]?.seq).toBe(20000); // newest first
    expect(state.total).toBe(20000);
    expect(elapsed).toBeLessThan(3000); // must stay interactive
  });

  it("deduplicates by seq and merges prepended pages", () => {
    const store = useEventsStore.getState();
    store.clear();
    store.push(fakeEvent(10));
    useEventsStore.getState().push(fakeEvent(10));
    expect(useEventsStore.getState().events.length).toBe(1);
    useEventsStore.getState().prependMany([fakeEvent(9), fakeEvent(10), fakeEvent(8)]);
    const seqs = useEventsStore.getState().events.map((e) => e.seq);
    expect(seqs).toEqual([10, 9, 8]);
  });
});
