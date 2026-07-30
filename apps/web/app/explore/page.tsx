"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { LayerControls } from "@/components/planet/LayerControls";
import { RegionDrawer } from "@/components/region/RegionDrawer";

const PlanetCanvas = dynamic(
  () => import("@/components/planet/PlanetCanvas").then((m) => m.PlanetCanvas),
  { ssr: false },
);

export default function ExplorePage() {
  const locale = usePlanetStore((s) => s.locale);
  const setPlanet = usePlanetStore((s) => s.setPlanet);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);

  const { data: planets } = useQuery({ queryKey: ["planets"], queryFn: () => api.getPlanets() });
  useEffect(() => {
    const p = planets?.planets?.[0];
    if (p) setPlanet({ id: p.id, seed: p.seed, name: p.name, tick: p.currentTick });
  }, [planets, setPlanet]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["planet", planetId],
    queryFn: () => api.getPlanet(planetId!),
    enabled: !!planetId,
  });

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-cyan/20">
        <PlanetCanvas />
        <LayerControls />
        <RegionDrawer />
      </div>
      <Panel title={dict.pages.explore}>
        {isLoading && <p className="text-sm text-muted">{dict.pages.loading}</p>}
        {isError && <p className="text-sm text-red">{dict.pages.offline}</p>}
        {data && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-cyan">{data.planet.name}</h2>
            <p className="text-xs text-muted">seed: {data.planet.seed}</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(data.stats || {}).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 p-2 text-center">
                  <div className="text-lg font-bold text-ink">{v}</div>
                  <div className="text-[10px] text-muted">{k}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge tone="gold">age {data.planet.ageYears}</Badge>
              <Badge tone="cyan">tick {data.planet.currentTick}</Badge>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
