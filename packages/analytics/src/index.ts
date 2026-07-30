export type AnalyticsEventName =
  | "session_start"
  | "planet_interact"
  | "contribution_started"
  | "contribution_applied"
  | "timeline_scrub"
  | "layer_changed"
  | "webgl_quality_changed"
  | "api_error";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props?: Record<string, string | number | boolean>;
  ts: string;
}

/** Privacy-safe in-memory analytics sink for sandbox; swap for OTEL exporter in prod */
export class AnalyticsBus {
  private events: AnalyticsEvent[] = [];

  track(name: AnalyticsEventName, props?: AnalyticsEvent["props"]) {
    this.events.push({ name, props, ts: new Date().toISOString() });
  }

  flush(): AnalyticsEvent[] {
    const out = [...this.events];
    this.events = [];
    return out;
  }
}

export const analytics = new AnalyticsBus();
