export type AnalyticsEvent = {
  name: string;
  properties?: Record<string, string | number | boolean | null>;
  ts?: number;
};

const buffer: AnalyticsEvent[] = [];

/** Privacy-aware analytics buffer — no PII by convention */
export function track(name: string, properties?: AnalyticsEvent["properties"]): void {
  if (properties) {
    for (const key of Object.keys(properties)) {
      if (/email|password|token|phone|ip/i.test(key)) {
        delete properties[key];
      }
    }
  }
  buffer.push({ name, properties, ts: Date.now() });
}

export function drainEvents(): AnalyticsEvent[] {
  return buffer.splice(0, buffer.length);
}

export function getBufferedCount(): number {
  return buffer.length;
}
