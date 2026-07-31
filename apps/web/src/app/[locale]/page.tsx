"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Empty, ErrorBox, Stat, Panel } from "@planet/ui";
import type { WorldEvent } from "@planet/shared-types";
import { MAP_LAYERS } from "@planet/shared-types";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { useLivePlanet } from "@/lib/ws";
import { TopBar } from "@/components/shell/TopBar";
import { LeftFeed } from "@/components/shell/LeftFeed";
import { RightPanel } from "@/components/shell/RightPanel";
import { BottomTimeline } from "@/components/shell/BottomTimeline";
import { RegionDrawer } from "@/components/shell/RegionDrawer";
import { CausalGraphView } from "@/components/CausalGraphView";
import { useToast } from "@planet/ui";

const GlobeCanvas = dynamic(
  () => import("@/components/globe/GlobeCanvas").then((m) => m.GlobeCanvas),
  { ssr: false },
);

export default function HomePage() {
  const { dict } = useI18n();
  const toast = useToast();
  const layer = usePlanetStore((s) => s.layer);
  const setLayer = usePlanetStore((s) => s.setLayer);
  const overlays = usePlanetStore((s) => s.overlays);
  const toggleOverlay = usePlanetStore((s) => s.toggleOverlay);
  const setPlanetId = usePlanetStore((s) => s.setPlanetId);
  const [liveEvents, setLiveEvents] = useState<WorldEvent[]>([]);
  const [chainEventId, setChainEventId] = useState<string | null>(null);
  const [eraFilter, setEraFilter] = useState<{ from: number; to: number } | null>(null);
  const [tick, setTick] = useState<number | null>(null);

  const {
    data: planet,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["planet-current"],
    queryFn: () => api().getPlanet(),
    retry: 1,
  });

  const planetId = planet?.id ?? null;
  if (planetId && planetId !== usePlanetStore.getState().planetId) {
    setPlanetId(planetId);
  }

  const { data: overlaysData } = useQuery({
    queryKey: ["overlays", planetId],
    queryFn: () => api().getOverlays(planetId!),
    enabled: Boolean(planetId),
    refetchInterval: 60_000,
  });

  const onEvent = useCallback(
    (evt: WorldEvent) => {
      setLiveEvents((prev) => [evt, ...prev].slice(0, 80));
      if (evt.importance >= 4) {
        toast.push(`⚠ ${evt.type}`, "danger");
      }
    },
    [toast],
  );
  const onTick = useCallback((t: number) => setTick(t), []);

  useLivePlanet(planetId, { onEvent, onTick });

  const grid = useMemo(
    () => ({ latBands: 36, lonBands: 72 }),
    [],
  );

  if (error) {
    return (
      <div className="auth-page">
        <div style={{ maxWidth: 460 }}>
          <ErrorBox>
            <strong>{dict.home.noPlanetTitle}</strong>
            <div style={{ marginTop: 6 }}>{dict.home.noPlanetBody}</div>
          </ErrorBox>
        </div>
      </div>
    );
  }

  const currentTick = tick ?? planet?.tick ?? 0;

  return (
    <div className="app-shell">
      <TopBar />
      <LeftFeed planetId={planetId} liveEvents={liveEvents} onChain={setChainEventId} eraFilter={eraFilter} />
      <main className="app-center">
        {isLoading ? (
          <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
            <Empty>{dict.common.loading}</Empty>
          </div>
        ) : (
          <>
            <GlobeCanvas
              planetId={planetId}
              seed={planet?.seed ?? 42}
              grid={grid}
              overlaysData={overlaysData ?? null}
              liveEvents={liveEvents}
              eraTick={eraFilter ? eraFilter.to : null}
              rotating={!eraFilter}
            />
            <div className="globe-hud globe-hud--layers">
              {MAP_LAYERS.map((l) => (
                <button
                  key={l}
                  className={`hud-chip ${layer === l ? "hud-chip--active" : ""}`}
                  onClick={() => setLayer(l)}
                >
                  {dict.layers[l]}
                </button>
              ))}
            </div>
            <div className="globe-hud globe-hud--overlays">
              {(Object.keys(overlays) as Array<keyof typeof overlays>).map((key) => (
                <button
                  key={key}
                  className={`hud-chip ${overlays[key] ? "hud-chip--active" : ""}`}
                  onClick={() => toggleOverlay(key)}
                >
                  {dict.overlays[key]}
                </button>
              ))}
            </div>
            <div className="globe-hint">{dict.home.rotateHint}</div>
            <RegionDrawer planetId={planetId} />
          </>
        )}
      </main>
      <RightPanel />
      <BottomTimeline planetId={planetId} currentTick={currentTick} eraFilter={eraFilter} onSelectEra={setEraFilter} />
      <CausalGraphView planetId={planetId} eventId={chainEventId} onClose={() => setChainEventId(null)} />
    </div>
  );
}
