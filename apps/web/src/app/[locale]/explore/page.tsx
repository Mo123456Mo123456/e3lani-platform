"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Empty, Spinner } from "@planet/ui";
import { BIOMES, type RegionInfo } from "@planet/shared-types";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";

export default function ExplorePage() {
  const { dict } = useI18n();
  const [biome, setBiome] = useState<string | null>(null);
  const { data: planet } = useQuery({ queryKey: ["planet-current"], queryFn: () => api().getPlanet() });
  const { data: regions, isLoading } = useQuery({
    queryKey: ["regions", planet?.id, biome],
    queryFn: () => api().get<RegionInfo[]>(`/planets/${planet!.id}/regions?biome=${biome ?? ""}&limit=60`),
    enabled: Boolean(planet),
  });

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{dict.nav.explore}</h1>
        </div>
        <div className="pb-chip-row" style={{ marginBottom: 16 }}>
          <button className={`hud-chip ${biome === null ? "hud-chip--active" : ""}`} onClick={() => setBiome(null)}>
            {dict.events.all}
          </button>
          {BIOMES.map((b) => (
            <button key={b} className={`hud-chip ${biome === b ? "hud-chip--active" : ""}`} onClick={() => setBiome(b)}>
              {b}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Spinner />
        ) : !(regions ?? []).length ? (
          <Empty>—</Empty>
        ) : (
          <div className="grid-cards">
            {(regions ?? []).map((region) => (
              <Card key={region.cellId}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Badge tone="nature">{region.biome}</Badge>
                  <span className="pb-faint" style={{ fontSize: 11 }}>
                    {region.lat.toFixed(1)}°, {region.lon.toFixed(1)}°
                  </span>
                </div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  {dict.region.fertility}: {Math.round(region.fertility * 100)}% · {dict.region.moisture}: {Math.round(region.moisture * 100)}%
                </div>
                {region.ownerCivName ? (
                  <div style={{ marginTop: 6 }}>
                    <Badge tone="civ">{region.ownerCivName}</Badge>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
