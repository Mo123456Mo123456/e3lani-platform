"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalyzedContribution,
  ContributionRequest,
  ScenarioOutcome,
  TimelineSnapshot,
  WorldOverview,
  SocketMessage,
} from "@living-planet/shared-types";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function accessToken(): string | null {
  return typeof window === "undefined" ? null : sessionStorage.getItem("planet_access_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = accessToken();
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `REQUEST_FAILED_${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function ensureSandboxSession(): Promise<void> {
  if (accessToken()) return;
  const sandboxEnabled =
    process.env.NEXT_PUBLIC_SANDBOX_MODE === "true" || process.env.NODE_ENV !== "production";
  if (!sandboxEnabled) return;
  const session = await request<{ accessToken: string }>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "explorer@azura.world",
      password: "Azura!2347",
    }),
  });
  sessionStorage.setItem("planet_access_token", session.accessToken);
}

export function useWorldOverview() {
  return useQuery({
    queryKey: ["world-overview"],
    queryFn: () => request<WorldOverview>("/v1/world/overview"),
    refetchInterval: 30_000,
  });
}

export function useSandboxAuth() {
  useEffect(() => {
    void ensureSandboxSession();
  }, []);
}

export function useWorldSocket() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;
    void ensureSandboxSession().then(() => {
      const token = accessToken();
      if (!token || cancelled) return;
      const websocketUrl = apiUrl.replace(/^http/, "ws");
      socket = new WebSocket(`${websocketUrl}/ws?token=${encodeURIComponent(token)}`);
      socket.onmessage = (message) => {
        const data = JSON.parse(message.data as string) as SocketMessage | { type: "CONNECTED" };
        if (data.type === "WORLD_DELTA") {
          void queryClient.invalidateQueries({ queryKey: ["world-overview"] });
        }
      };
    });
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [queryClient]);
}

export async function analyzeContribution(input: ContributionRequest) {
  await ensureSandboxSession();
  return request<AnalyzedContribution>("/v1/contributions/analyze", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function projectScenarios(analysis: AnalyzedContribution, regionId: string) {
  await ensureSandboxSession();
  const result = await request<{ outcomes: ScenarioOutcome[]; probabilistic: true }>(
    "/v1/contributions/scenarios",
    {
      method: "POST",
      body: JSON.stringify({ analysis, regionId }),
    },
  );
  return result.outcomes;
}

export async function commitContribution(
  analysis: AnalyzedContribution,
  regionId: string,
  expectedPlanetVersion: number,
) {
  await ensureSandboxSession();
  return request<{ contributionId: string; version: number }>("/v1/contributions", {
    method: "POST",
    body: JSON.stringify({ analysis, regionId, expectedPlanetVersion }),
  });
}

export async function advanceTick() {
  await ensureSandboxSession();
  return request<{ tick: number; year: number; version: number }>("/v1/simulation/tick", {
    method: "POST",
    body: "{}",
  });
}

export async function getSnapshot(tick: number) {
  return request<TimelineSnapshot>(`/v1/simulation/snapshots/${tick}`);
}
