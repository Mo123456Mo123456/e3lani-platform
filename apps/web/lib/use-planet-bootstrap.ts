"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";

/** Ensure planetId is loaded from API for list pages */
export function usePlanetBootstrap() {
  const setPlanet = usePlanetStore((s) => s.setPlanet);
  const planetId = usePlanetStore((s) => s.planetId);
  const { data } = useQuery({
    queryKey: ["planets"],
    queryFn: () => api.getPlanets(),
    enabled: !planetId,
  });

  useEffect(() => {
    const p = data?.planets?.[0];
    if (p && !planetId) setPlanet({ id: p.id, seed: p.seed, name: p.name, tick: p.currentTick });
  }, [data, planetId, setPlanet]);
}
