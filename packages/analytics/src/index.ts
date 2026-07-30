export type AnalyticsEvent =
  | { name: "globe.interaction"; properties: { action: "rotate" | "zoom" | "region_select"; quality: string } }
  | { name: "contribution.funnel"; properties: { step: number; category: string; completed: boolean } }
  | { name: "simulation.tick"; properties: { durationMs: number; eventCount: number; tick: number } }
  | { name: "webgl.performance"; properties: { fps: number; deviceTier: string } };

export interface AnalyticsSink {
  capture(event: AnalyticsEvent): Promise<void>;
}

export class PrivacyPreservingConsoleSink implements AnalyticsSink {
  async capture(event: AnalyticsEvent): Promise<void> {
    console.debug("[analytics]", event);
  }
}
