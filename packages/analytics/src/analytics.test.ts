import { describe, expect, it } from "vitest";
import { AnalyticsCollector, type AnalyticsEvent } from "./index.js";

describe("analytics collector", () => {
  it("batches and flushes", () => {
    const batches: AnalyticsEvent[][] = [];
    const collector = new AnalyticsCollector({ send: (b) => batches.push(b) });
    collector.track("planet_viewed", { planetId: "p1" });
    collector.track("layer_changed", { layer: "pollution" });
    collector.flush();
    expect(batches.length).toBe(1);
    expect(batches[0]!.length).toBe(2);
    expect(batches[0]![0]!.name).toBe("planet_viewed");
  });

  it("auto-flushes at 20 events", () => {
    const batches: AnalyticsEvent[][] = [];
    const collector = new AnalyticsCollector({ send: (b) => batches.push(b) });
    for (let i = 0; i < 20; i++) collector.track("globe_interacted");
    expect(batches.length).toBe(1);
  });

  it("re-queues on sink failure", () => {
    let calls = 0;
    const collector = new AnalyticsCollector({
      send: () => {
        calls++;
        if (calls === 1) throw new Error("offline");
      },
    });
    collector.track("session_started");
    collector.flush();
    collector.flush();
    expect(calls).toBe(2);
  });
});
