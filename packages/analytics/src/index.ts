export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean | null>;
  ts?: number;
}

const buffer: AnalyticsEvent[] = [];

export function track(event: AnalyticsEvent): void {
  buffer.push({ ...event, ts: event.ts ?? Date.now() });
  if (buffer.length > 5000) buffer.shift();
}

export function getRecentEvents(limit = 100): AnalyticsEvent[] {
  return buffer.slice(-limit);
}

export function summarize(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of buffer) {
    counts[e.name] = (counts[e.name] ?? 0) + 1;
  }
  return counts;
}
