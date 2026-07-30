import {
  ContributionAnalysisSchema,
  PlanetRegionSchema,
  WorldEventSchema,
  WorldSummarySchema,
  type AnalyzeContributionRequest,
  type CommitContributionRequest,
  type ContributionAnalysis,
  type PlanetRegion,
  type WorldEvent,
  type WorldSummary,
} from "@planet/shared-types";
import { z } from "zod";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

export type WorldSummaryResponse = WorldSummary & {
  persistenceMode: "postgresql" | "memory-sandbox";
};

export async function fetchWorld(): Promise<WorldSummaryResponse> {
  const data = await requestJson("/api/v1/worlds/current");
  return WorldSummarySchema.extend({
    persistenceMode: z.enum(["postgresql", "memory-sandbox"]),
  }).parse(data);
}

export async function fetchRegions(worldId: string): Promise<PlanetRegion[]> {
  const data = await requestJson(`/api/v1/worlds/${worldId}/regions`);
  return z.object({ data: z.array(PlanetRegionSchema) }).parse(data).data;
}

export async function fetchEvents(worldId: string): Promise<WorldEvent[]> {
  const data = await requestJson(
    `/api/v1/worlds/${worldId}/events?limit=120`,
  );
  return z.object({ data: z.array(WorldEventSchema) }).parse(data).data;
}

export async function analyzeContribution(
  request: AnalyzeContributionRequest,
): Promise<ContributionAnalysis> {
  const data = await requestJson("/api/v1/contributions/analyze", {
    method: "POST",
    body: JSON.stringify(request),
  });
  return ContributionAnalysisSchema.parse(data);
}

export async function commitContribution(
  worldId: string,
  request: CommitContributionRequest,
) {
  return requestJson(`/api/v1/worlds/${worldId}/contributions`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function runTicks(worldId: string, count: number) {
  return requestJson(`/api/v1/worlds/${worldId}/ticks`, {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export { API_URL };
