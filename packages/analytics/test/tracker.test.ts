import { describe, expect, it } from "vitest";
import { createTracker, HttpSink, InMemorySink } from "../src/index";

describe("analytics tracker", () => {
  it("writes typed events to the sink with timestamps", () => {
    const sink = new InMemorySink();
    const tracker = createTracker(sink);
    tracker.track("contribution_placed", { userId: "u1", planetId: "p1", properties: { category: "plant" } });
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]!.name).toBe("contribution_placed");
    expect(sink.events[0]!.at).toBeTruthy();
  });

  it("http sink batches and never throws on network failure", async () => {
    const sink = new HttpSink("http://127.0.0.1:1/unreachable", 2);
    sink.write({ name: "planet_viewed", at: new Date().toISOString() });
    sink.write({ name: "layer_changed", at: new Date().toISOString() }); // triggers flush
    await sink.flush(); // unreachable host — must swallow the error
    expect(true).toBe(true);
  });
});
