"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";

interface PlanetRow {
  id: string;
  name: string;
  seed: string;
  status: string;
  config: { gridWidth?: number; gridHeight?: number };
}

/** picks the first live planet and seeds the world store */
export function usePlanetBootstrap(): { loading: boolean; error: boolean } {
  const planetId = useWorldStore((s) => s.planetId);
  const setPlanet = useWorldStore((s) => s.setPlanet);
  const setStats = useWorldStore((s) => s.setStats);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["worlds"],
    queryFn: () => api<PlanetRow[]>("/api/worlds"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (planetId || !data || data.length === 0) return;
    const planet = data.find((p) => p.status === "active") ?? data[0]!;
    setPlanet({
      planetId: planet.id,
      seed: planet.seed,
      gridWidth: planet.config.gridWidth ?? 144,
      gridHeight: planet.config.gridHeight ?? 72,
    });
  }, [data, planetId, setPlanet]);

  // keep stats fresh even when WS is down
  const { data: stats } = useQuery({
    queryKey: ["sim-status", planetId],
    queryFn: () => api<{ civilizations: number } & Parameters<typeof setStats>[0]>(`/api/simulation/${planetId}/status`),
    enabled: !!planetId,
    refetchInterval: 45_000,
  });
  useEffect(() => {
    if (stats) setStats(stats);
  }, [stats, setStats]);

  return { loading: isLoading || !planetId, error: isError || (!!data && data.length === 0) };
}
