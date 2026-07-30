import type {
  ApiCommitResponse,
  ApiContributionAnalysis,
  ApiPlanetSummary,
  ApiPreviewResponse,
  ApiTimelineSnapshot,
  ApiWorldEvent,
  ApiWorldRegion,
} from "./api-contract";
import type {
  ContributionAnalysis,
  ContributionRequest,
  ContributionResult,
  EventKind,
  ForecastMetric,
  Region,
  SimulationForecast,
  TimelinePoint,
  WorldEvent,
  WorldSnapshot,
} from "./types";
import { hashString } from "./world";

const BIOME_COLORS: Record<string, [string, string]> = {
  forest: ["#197454", "#73f5b4"],
  crystal: ["#286f72", "#7ffff0"],
  steppe: ["#5c8555", "#b7e982"],
  desert: ["#a36d3f", "#ffd078"],
  polar: ["#8ebfc1", "#d8ffff"],
  ocean: ["#116c82", "#62dff5"],
  wetland: ["#28785f", "#7ee6b4"],
  mountain: ["#697166", "#c3d9c6"],
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function localized(value: string): { ar: string; en: string } {
  return { ar: value, en: value };
}

function biomeColors(biome: string): [string, string] {
  const key = biome.toLowerCase();
  const match = Object.entries(BIOME_COLORS).find(([name]) =>
    key.includes(name),
  );
  if (match) return match[1];
  const hue = hashString(key) % 360;
  return [`hsl(${hue} 42% 35%)`, `hsl(${hue} 78% 72%)`];
}

function eventKind(category: string): EventKind {
  const value = category.toLowerCase();
  if (["technology", "economy", "energy"].includes(value)) return "energy";
  if (["health", "water"].includes(value)) return "water";
  if (["society", "diplomacy", "community"].includes(value)) {
    return "community";
  }
  return "climate";
}

function recordValue(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : undefined;
}

function snapshotSummary(
  snapshot: ApiTimelineSnapshot,
): Record<string, unknown> {
  const summary = snapshot.state.summary;
  return summary && typeof summary === "object" && !Array.isArray(summary)
    ? (summary as Record<string, unknown>)
    : snapshot.state;
}

export function adaptRegion(region: ApiWorldRegion): Region {
  const [terrainColor, accentColor] = biomeColors(region.biome);
  const stability = Math.round(clamp(region.stability, 0, 1) * 100);
  return {
    id: region.id,
    name: localized(region.name),
    latitude: region.latitude,
    longitude: region.longitude,
    population: region.population,
    vitality: stability,
    stability,
    terrainColor,
    accentColor,
    cityLights: clamp(Math.round(Math.log10(region.population + 1) * 4), 3, 48),
  };
}

export function adaptTimeline(
  snapshots: ApiTimelineSnapshot[],
  summary: ApiPlanetSummary,
): TimelinePoint[] {
  const points = snapshots
    .map((snapshot) => {
      const state = snapshotSummary(snapshot);
      const stability = recordValue(state, "stability") ?? summary.stability;
      const biodiversity =
        recordValue(state, "biodiversity") ?? summary.biodiversity;
      return {
        year: snapshot.tick,
        vitality: Math.round(clamp((stability + biodiversity) / 2, 0, 1) * 100),
        temperature:
          recordValue(state, "averageTemperature") ??
          summary.averageTemperature,
        population: recordValue(state, "population") ?? summary.population,
        label: localized(snapshot.reason.replaceAll("_", " ")),
      };
    })
    .sort((left, right) => left.year - right.year);

  if (points.length > 0) return points;
  return [
    {
      year: summary.currentTick,
      vitality: Math.round(
        clamp((summary.stability + summary.biodiversity) / 2, 0, 1) * 100,
      ),
      temperature: summary.averageTemperature,
      population: summary.population,
    },
  ];
}

export function composeWorldSnapshot(
  summary: ApiPlanetSummary,
  rawRegions: ApiWorldRegion[],
  rawTimeline: ApiTimelineSnapshot[],
): WorldSnapshot {
  const regions = rawRegions.map(adaptRegion);
  const timeline = adaptTimeline(rawTimeline, summary);
  return {
    id: summary.id,
    name: summary.name,
    generatedAt: rawTimeline[0]?.createdAt ?? new Date(0).toISOString(),
    cycle: summary.currentTick,
    temperature: summary.averageTemperature,
    population: summary.population,
    vitality: Math.round(
      clamp((summary.stability + summary.biodiversity) / 2, 0, 1) * 100,
    ),
    stability: Math.round(clamp(summary.stability, 0, 1) * 100),
    biodiversity: Math.round(clamp(summary.biodiversity, 0, 1) * 100),
    isPaused: summary.isPaused,
    regions,
    timeline,
  };
}

export function adaptEvents(
  events: ApiWorldEvent[],
  regions: Region[],
): WorldEvent[] {
  return events.map((event) => {
    const visualRegion =
      regions.length > 0
        ? regions[hashString(event.id) % regions.length]
        : undefined;
    return {
      id: event.id,
      kind: eventKind(event.category),
      title: localized(event.title),
      description: localized(event.summary),
      regionId: visualRegion?.id ?? "",
      latitude: visualRegion?.latitude ?? 0,
      longitude: visualRegion?.longitude ?? 0,
      impact: Math.round(clamp(event.magnitude, 0, 1) * 10),
      occurredAt: event.createdAt,
    };
  });
}

export function adaptAnalysis(
  analysis: ApiContributionAnalysis,
  provider?: string,
): ContributionAnalysis {
  return {
    title: analysis.title,
    summary: analysis.summary,
    category: analysis.category,
    plausibility: analysis.plausibility,
    confidence: analysis.confidence,
    effects: analysis.effects.map((effect) => ({ ...effect })),
    warnings: [...analysis.warnings],
    ...(provider ? { provider } : {}),
  };
}

function effectRationale(
  analysis: ContributionAnalysis,
  positive: boolean,
): string[] {
  return analysis.effects
    .filter((effect) => (positive ? effect.delta >= 0 : effect.delta < 0))
    .map((effect) => effect.rationale);
}

export function adaptPreview(response: ApiPreviewResponse): SimulationForecast {
  const analysis = adaptAnalysis(response.analysis);
  const metrics: ForecastMetric[] = response.preview.projectedEffects.map(
    (effect) => ({
      key: effect.metric,
      low: effect.p10,
      median: effect.median,
      high: effect.p90,
      unit: "Δ",
    }),
  );
  return {
    confidence: analysis.confidence,
    acceptanceProbability: response.preview.acceptanceProbability,
    riskOfInstability: response.preview.riskOfInstability,
    samples: response.preview.samples,
    summary: localized(analysis.summary),
    metrics,
    risks: [...analysis.warnings, ...effectRationale(analysis, false)].filter(
      (value, index, values) => values.indexOf(value) === index,
    ),
    benefits: effectRationale(analysis, true),
    analysis,
  };
}

export function adaptCommit(
  response: ApiCommitResponse,
  request: ContributionRequest,
  now = new Date().toISOString(),
): ContributionResult {
  return {
    id: response.result.contributionId,
    acceptedAt: response.result.events[0]?.createdAt ?? now,
    affectedRegionId: request.regionId ?? "",
    message: {
      ar: response.result.replayed
        ? "تم تأكيد المساهمة السابقة دون تكرار أثرها."
        : "اعتُمدت المساهمة وبدأ أثرها السببي في الكوكب.",
      en: response.result.replayed
        ? "The existing contribution was confirmed without duplicating its impact."
        : "The contribution was committed and its causal impact has begun.",
    },
  };
}

export function buildProposal(draft: {
  category: string | null;
  title: string;
  idea: string;
}): string {
  return [
    draft.title.trim(),
    draft.idea.trim(),
    draft.category ? `Primary lens: ${draft.category}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
