import { describe, expect, it } from "vitest";

import {
  adaptCommit,
  adaptEvents,
  adaptPreview,
  buildProposal,
  composeWorldSnapshot,
} from "./adapters";
import type {
  ApiCommitResponse,
  ApiPlanetSummary,
  ApiPreviewResponse,
  ApiWorldRegion,
} from "./api-contract";

const summary: ApiPlanetSummary = {
  id: "planet-1",
  name: "Orion",
  slug: "orion",
  currentTick: 12,
  isPaused: false,
  stability: 0.72,
  biodiversity: 0.84,
  averageTemperature: 18.4,
  population: 24_000_000,
  counts: {
    regions: 1,
    civilizations: 2,
    cities: 4,
    resources: 5,
    species: 8,
    plants: 13,
    technologies: 3,
  },
};

const region: ApiWorldRegion = {
  id: "region-1",
  planetId: "planet-1",
  name: "Crystal Forest",
  biome: "Crystal Forest",
  latitude: 25,
  longitude: 45,
  population: 1_500_000,
  stability: 0.75,
};

const preview: ApiPreviewResponse = {
  analysis: {
    title: "A grounded proposal",
    summary: "A server-generated grounded summary.",
    category: "ecology",
    plausibility: 0.8,
    confidence: 0.78,
    causalEventIds: [],
    warnings: ["Monitor water use."],
    effects: [
      {
        metric: "biodiversity",
        delta: 0.08,
        regionId: "region-1",
        civilizationId: null,
        rationale: "Habitat connectivity improves.",
      },
      {
        metric: "stability",
        delta: -0.02,
        regionId: "region-1",
        civilizationId: null,
        rationale: "Short transition cost.",
      },
    ],
  },
  preview: {
    samples: 250,
    acceptanceProbability: 0.79,
    riskOfInstability: 0.05,
    projectedEffects: [
      {
        metric: "biodiversity",
        p10: 0.05,
        median: 0.08,
        p90: 0.1,
      },
    ],
  },
};

describe("backend API adapters", () => {
  it("composes summary, region, and timeline records without fake history", () => {
    const world = composeWorldSnapshot(summary, [region], []);
    expect(world).toMatchObject({
      id: "planet-1",
      cycle: 12,
      vitality: 78,
      stability: 72,
      biodiversity: 84,
    });
    expect(world.regions[0]).toMatchObject({
      id: "region-1",
      stability: 75,
    });
    expect(world.timeline).toHaveLength(1);
    expect(world.timeline[0]?.year).toBe(12);
  });

  it("maps percentile preview data and server-derived risk text", () => {
    const forecast = adaptPreview(preview);
    expect(forecast.acceptanceProbability).toBe(0.79);
    expect(forecast.metrics[0]).toEqual({
      key: "biodiversity",
      low: 0.05,
      median: 0.08,
      high: 0.1,
      unit: "Δ",
    });
    expect(forecast.benefits).toContain("Habitat connectivity improves.");
    expect(forecast.risks).toContain("Monitor water use.");
    expect(forecast.risks).toContain("Short transition cost.");
  });

  it("places backend events deterministically on available regions", () => {
    const regions = composeWorldSnapshot(summary, [region], []).regions;
    const event = {
      id: "event-1",
      planetId: "planet-1",
      tick: 12,
      title: "New habitat",
      summary: "A habitat was created.",
      category: "ecology",
      magnitude: 0.4,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(adaptEvents([event], regions)[0]).toMatchObject({
      regionId: "region-1",
      latitude: 25,
      longitude: 45,
      impact: 4,
    });
  });

  it("preserves commit identity and idempotent replay messaging", () => {
    const response: ApiCommitResponse = {
      analysis: preview.analysis,
      result: {
        contributionId: "contribution-1",
        tick: 13,
        events: [],
        snapshotId: "snapshot-1",
        replayed: true,
      },
    };
    const result = adaptCommit(
      response,
      {
        planetId: "planet-1",
        proposal: "A detailed proposal",
        regionId: "region-1",
      },
      "2026-01-01T00:00:00.000Z",
    );
    expect(result.id).toBe("contribution-1");
    expect(result.affectedRegionId).toBe("region-1");
    expect(result.acceptedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("builds one bounded proposal from user-authored idea fields", () => {
    expect(
      buildProposal({
        category: "climate",
        title: "Cooling gardens",
        idea: "Connect shaded gardens across the district.",
      }),
    ).toContain("Primary lens: climate");
  });
});
