/**
 * Privacy-conscious analytics: counters and timings, never payload content.
 * Sinks are pluggable (console in dev, HTTP collector in production).
 */

export interface AnalyticsEvent {
  name: string;
  /** Numeric metrics only — no user-generated text, no PII. */
  metrics?: Record<string, number>;
  at: number;
}

export interface AnalyticsSink {
  emit(event: AnalyticsEvent): void;
  flush?(): Promise<void>;
}

export class ConsoleSink implements AnalyticsSink {
  emit(event: AnalyticsEvent): void {
    console.log(`[analytics] ${event.name}`, event.metrics ?? {});
  }
}

export class HttpSink implements AnalyticsSink {
  private buffer: AnalyticsEvent[] = [];
  constructor(private url: string, private batchSize = 20) {}
  emit(event: AnalyticsEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.batchSize) void this.flush();
  }
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch),
      });
    } catch {
      // Analytics must never break the product; drop on failure.
    }
  }
}

export class Tracker {
  private counters = new Map<string, number>();
  constructor(private sink: AnalyticsSink) {}

  track(name: string, metrics: Record<string, number> = {}): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + 1);
    this.sink.emit({ name, metrics, at: Date.now() });
  }

  /** Measure a synchronous or async operation's duration in ms. */
  async time<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      this.track(name, { durationMs: Date.now() - start });
    }
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }
}

export const ANALYTICS_EVENTS = {
  ContributionCreated: "contribution.created",
  ContributionApplied: "contribution.applied",
  WorldViewed: "world.viewed",
  LayerToggled: "layer.toggled",
  TickCompleted: "simulation.tick_completed",
  AiRequest: "ai.request",
  WebglError: "webgl.error",
  ApiLatency: "api.latency",
} as const;
