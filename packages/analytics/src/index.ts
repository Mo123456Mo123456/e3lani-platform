export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  createdAt?: string;
}

const buffer: AnalyticsEvent[] = [];

export function track(event: AnalyticsEvent): void {
  buffer.push({ ...event, createdAt: event.createdAt ?? new Date().toISOString() });
}

export function drainAnalytics(): AnalyticsEvent[] {
  return buffer.splice(0, buffer.length);
}
