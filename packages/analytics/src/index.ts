export type AnalyticsEventName =
  | "session_start"
  | "planet_interact"
  | "contribution_started"
  | "contribution_applied"
  | "timeline_seek"
  | "layer_changed"
  | "webgl_fps"
  | "api_latency"
  | "ai_cost";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  userId?: string;
  planetId?: string;
  properties?: Record<string, string | number | boolean>;
  ts: string;
}

export function createAnalyticsEvent(
  name: AnalyticsEventName,
  properties?: AnalyticsEvent["properties"],
  userId?: string,
): AnalyticsEvent {
  return {
    name,
    userId,
    properties,
    ts: new Date().toISOString(),
  };
}
