/**
 * Privacy-conscious analytics: a typed event taxonomy + a tiny collector that
 * batches to the API. No PII beyond an anonymous session id; nothing leaves
 * the platform (no third-party trackers).
 */
export const ANALYTICS_EVENTS = [
  "session_started",
  "planet_viewed",
  "globe_interacted",
  "region_opened",
  "layer_changed",
  "timeline_scrubbed",
  "contribution_started",
  "contribution_previewed",
  "contribution_confirmed",
  "scenarios_viewed",
  "dashboard_viewed",
  "fps_sample",
  "webgl_error",
  "ws_reconnected",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  at: number;
  sessionId: string;
  props?: Record<string, string | number | boolean>;
}

export interface AnalyticsSink {
  send(batch: AnalyticsEvent[]): void;
}

export class AnalyticsCollector {
  private queue: AnalyticsEvent[] = [];
  private readonly sessionId: string;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly sink: AnalyticsSink,
    sessionId?: string,
  ) {
    this.sessionId = sessionId ?? `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  track(name: AnalyticsEventName, props?: AnalyticsEvent["props"]): void {
    this.queue.push({ name, at: Date.now(), sessionId: this.sessionId, props });
    if (this.queue.length >= 20) this.flush();
  }

  startAutoFlush(intervalMs = 15_000): void {
    this.stop();
    this.timer = setInterval(() => this.flush(), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  flush(): void {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    try {
      this.sink.send(batch);
    } catch {
      this.queue.unshift(...batch); // retry later
    }
  }
}

/** console sink for development */
export const consoleSink: AnalyticsSink = {
  send(batch) {
    console.debug("[analytics]", batch.length, "events");
  },
};
