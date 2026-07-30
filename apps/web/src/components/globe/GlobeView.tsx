"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LayerPayload, QualityPreset, WorldDelta } from "@kawkab/shared-types";
import { api } from "@/lib/api";
import { onWsMessage, connectPlanet } from "@/lib/ws";
import { useWorldStore } from "@/lib/store";
import { PlanetCanvas, type ArcPath, type CityMarker, type WarFront } from "./PlanetCanvas";
import { usePlanetTextures } from "./usePlanetTextures";
import type { GenerateRequest } from "./worker";

interface CityRow {
  id: string;
  name: string;
  civId: string;
  population: number;
  isCapital: boolean;
  lat: number;
  lon: number;
  color: string;
}

interface PlantRow {
  id: string;
  traits: { luminosity?: number };
  cells: Array<{ lat: number; lon: number }>;
  tracked: boolean;
}

interface RouteRow {
  id: string;
  active: boolean;
  path: Array<{ lat: number; lon: number }>;
}

interface MigrationRow {
  id: string;
  completedTick: number | null;
  path: Array<{ lat: number; lon: number }>;
}

interface WarRow {
  id: string;
  status: string;
  frontCells: Array<{ lat: number; lon: number }>;
}

const QUALITY_ORDER: QualityPreset[] = ["ultra", "high", "medium", "power_saver"];

export function GlobeView() {
  const planetId = useWorldStore((s) => s.planetId);
  const gridWidth = useWorldStore((s) => s.gridWidth);
  const gridHeight = useWorldStore((s) => s.gridHeight);
  const activeLayer = useWorldStore((s) => s.activeLayer);
  const quality = useWorldStore((s) => s.quality);
  const heavyEffects = useWorldStore((s) => s.heavyEffects);
  const selectedRegion = useWorldStore((s) => s.selectedRegion);
  const feed = useWorldStore((s) => s.feed);

  // cities & luminous plants drive the night-lights texture
  const { data: cities } = useQuery({
    queryKey: ["cities", planetId],
    queryFn: () => api<CityRow[]>(`/api/worlds/${planetId}/cities`),
    enabled: !!planetId,
  });
  const { data: plants } = useQuery({
    queryKey: ["plants-lights", planetId],
    queryFn: () => api<PlantRow[]>(`/api/worlds/${planetId}/plants`),
    enabled: !!planetId,
    staleTime: 60_000,
  });

  const lights = useMemo<GenerateRequest["lights"] | null>(() => {
    if (!cities || !plants) return null;
    const glowPlants = plants
      .filter((p) => p.tracked && (p.traits.luminosity ?? 0) > 0.3)
      .flatMap((p) => p.cells.map((c) => ({ lat: c.lat, lon: c.lon })))
      .slice(0, 800);
    return { cities: cities.map((c) => ({ lat: c.lat, lon: c.lon, population: c.population })), glowPlants };
  }, [cities, plants]);

  const textures = usePlanetTextures(lights);

  // websocket: apply deltas to textures + store
  useEffect(() => {
    if (!planetId) return;
    connectPlanet(planetId);
    const off = onWsMessage((msg) => {
      if (msg.type === "delta") {
        textures.applyDelta(msg.delta as WorldDelta);
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetId, textures.ready]);

  // overlay layer data
  const { data: layerPayload } = useQuery({
    queryKey: ["layer", planetId, activeLayer],
    queryFn: () => api<LayerPayload>(`/api/worlds/${planetId}/layers/${activeLayer}`),
    enabled: !!planetId && activeLayer !== "surface",
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (!textures.ready) return;
    textures.applyLayer(activeLayer === "surface" ? null : (layerPayload ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerPayload, activeLayer, textures.ready]);

  // routes / migrations / wars for markers
  const { data: routes } = useQuery({
    queryKey: ["routes", planetId],
    queryFn: () => api<RouteRow[]>(`/api/worlds/${planetId}/trade-routes`),
    enabled: !!planetId,
    refetchInterval: 45_000,
  });
  const { data: migrations } = useQuery({
    queryKey: ["migrations", planetId],
    queryFn: () => api<MigrationRow[]>(`/api/worlds/${planetId}/migrations`),
    enabled: !!planetId,
    refetchInterval: 45_000,
  });
  const { data: wars } = useQuery({
    queryKey: ["wars", planetId],
    queryFn: () => api<WarRow[]>(`/api/worlds/${planetId}/wars`),
    enabled: !!planetId,
    refetchInterval: 30_000,
  });

  const cityMarkers = useMemo<CityMarker[]>(
    () => (cities ?? []).map((c) => ({ id: c.id, lat: c.lat, lon: c.lon, population: c.population, isCapital: c.isCapital, color: c.color, name: c.name })),
    [cities],
  );
  const tradeArcs = useMemo<ArcPath[]>(
    () => (routes ?? []).filter((r) => r.active).map((r) => ({ id: r.id, points: r.path, color: "#ffd43b" })),
    [routes],
  );
  const migrationArcs = useMemo<ArcPath[]>(
    () => (migrations ?? []).filter((m) => m.completedTick === null).map((m) => ({ id: m.id, points: m.path, color: "#9775fa" })),
    [migrations],
  );
  const warFronts = useMemo<WarFront[]>(
    () => (wars ?? []).filter((w) => w.status === "active").flatMap((w) => w.frontCells.slice(0, 3).map((c, i) => ({ id: `${w.id}-${i}`, lat: c.lat, lon: c.lon }))),
    [wars],
  );

  const onRegionClick = useCallback(async (index: number) => {
    const store = useWorldStore.getState();
    store.selectRegion(index, null);
    try {
      const data = await api<NonNullable<typeof store.selectedRegionData>>(`/api/worlds/${store.planetId}/regions/${index}`);
      useWorldStore.getState().selectRegion(index, data);
    } catch {
      useWorldStore.getState().selectRegion(index, null);
    }
  }, []);

  const lastQualityChange = useRef(0);
  const onFpsSample = useCallback(
    (fps: number) => {
      const store = useWorldStore.getState();
      if (!store.autoQuality) return;
      const now = Date.now();
      if (now - lastQualityChange.current < 8000) return;
      const idx = QUALITY_ORDER.indexOf(store.quality);
      if (fps < 42 && idx < QUALITY_ORDER.length - 1) {
        lastQualityChange.current = now;
        store.setQuality(QUALITY_ORDER[idx + 1]!);
      }
    },
    [],
  );

  return (
    <div className="relative h-full w-full">
      <PlanetCanvas
        textures={textures}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        cities={cityMarkers}
        tradeArcs={tradeArcs}
        migrationArcs={migrationArcs}
        warFronts={warFronts}
        eventMarkers={feed.filter((e) => e.magnitude >= 0.5 && e.region).slice(0, 12)}
        selectedRegion={selectedRegion}
        quality={quality}
        heavyEffects={heavyEffects}
        onRegionClick={onRegionClick}
        onFpsSample={onFpsSample}
      />
      {!textures.ready && (
        <div className="absolute inset-0 flex items-center justify-center text-dim text-sm">
          <span className="animate-pulse">…</span>
        </div>
      )}
    </div>
  );
}
