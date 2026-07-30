/** Lightweight analytics event helpers — no PII by default */
export type AnalyticsEvent = {
  name: string;
  props?: Record<string, string | number | boolean>;
  ts?: number;
};

export function track(event: AnalyticsEvent, sink: (e: AnalyticsEvent) => void = console.debug) {
  sink({ ...event, ts: event.ts ?? Date.now() });
}
