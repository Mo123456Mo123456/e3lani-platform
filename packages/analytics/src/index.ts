/**
 * @planet/analytics — typed product/ops analytics with pluggable sinks.
 * No sensitive payloads are collected: ids, counts and durations only.
 */

export interface AnalyticsEvent {
  name:
    | "user_registered"
    | "user_login"
    | "contribution_analyzed"
    | "contribution_placed"
    | "contribution_rejected"
    | "scenario_requested"
    | "planet_viewed"
    | "layer_changed"
    | "simulation_tick"
    | "ai_request"
    | "api_error"
    | "ws_client_connected"
    | "ws_client_disconnected";
  userId?: string;
  planetId?: string;
  properties?: Record<string, string | number | boolean>;
  at: string;
}

export interface AnalyticsSink {
  write(event: AnalyticsEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
}

export class InMemorySink implements AnalyticsSink {
  readonly events: AnalyticsEvent[] = [];
  write(event: AnalyticsEvent): void {
    this.events.push(event);
  }
}

/** Ships events to an HTTP collector (e.g. the API's /analytics endpoint). */
export class HttpSink implements AnalyticsSink {
  private buffer: AnalyticsEvent[] = [];
  constructor(
    private readonly url: string,
    private readonly batchSize = 20,
  ) {}
  write(event: AnalyticsEvent): void {
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
        body: JSON.stringify({ events: batch }),
      });
    } catch {
      // analytics must never break the product; drop the batch
    }
  }
}

export class Tracker {
  constructor(private readonly sink: AnalyticsSink) {}
  track(
    name: AnalyticsEvent["name"],
    ctx: {
      userId?: string;
      planetId?: string;
      properties?: AnalyticsEvent["properties"];
    } = {},
  ): void {
    void this.sink.write({
      name,
      userId: ctx.userId,
      planetId: ctx.planetId,
      properties: ctx.properties,
      at: new Date().toISOString(),
    });
  }
}

export function createTracker(sink?: AnalyticsSink): Tracker {
  return new Tracker(sink ?? new InMemorySink());
}
