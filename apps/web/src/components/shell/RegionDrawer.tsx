"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Panel, Progress, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";

export function RegionDrawer({ planetId }: { planetId: string | null }) {
  const { dict, locale } = useI18n();
  const selectedCell = usePlanetStore((s) => s.selectedCell);
  const setSelectedCell = usePlanetStore((s) => s.setSelectedCell);

  const { data: region, isLoading } = useQuery({
    queryKey: ["region", planetId, selectedCell],
    queryFn: () => api().getRegion(planetId!, selectedCell!),
    enabled: Boolean(planetId) && selectedCell !== null,
  });

  if (selectedCell === null) return null;

  const rows: Array<{ label: string; value: React.ReactNode; pct?: number; tone?: "tech" | "nature" | "danger" | "civ" }> = region
    ? [
        { label: dict.region.biome, value: <Badge tone="nature">{region.biome}</Badge> },
        { label: dict.region.temp, value: `${region.temp.toFixed(1)}°C`, pct: (region.temp + 40) / 80, tone: "danger" },
        { label: dict.region.moisture, value: `${Math.round(region.moisture * 100)}%`, pct: region.moisture, tone: "tech" },
        { label: dict.region.fertility, value: `${Math.round(region.fertility * 100)}%`, pct: region.fertility, tone: "nature" },
        { label: dict.region.pollution, value: `${Math.round(region.pollution * 100)}%`, pct: region.pollution, tone: "danger" },
        { label: dict.region.vegetation, value: `${Math.round(region.vegetation * 100)}%`, pct: region.vegetation, tone: "nature" },
        {
          label: dict.region.owner,
          value: region.ownerCivName ? <Badge tone="civ">{region.ownerCivName}</Badge> : dict.region.none,
        },
        { label: dict.region.city, value: region.cityName ?? dict.region.none },
        {
          label: dict.region.deposits,
          value:
            Object.keys(region.deposits).length > 0 ? (
              <span className="pb-chip-row">
                {Object.entries(region.deposits).map(([res, qty]) => (
                  <Badge key={res} tone="tech">
                    {res}: {Math.round(qty)}
                  </Badge>
                ))}
              </span>
            ) : (
              dict.region.none
            ),
        },
        {
          label: dict.region.life,
          value: `${region.presentSpecies} / ${region.presentPlants}`,
        },
      ]
    : [];

  return (
    <div className="region-drawer">
      <Panel
        title={`${dict.region.title} #${selectedCell}`}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setSelectedCell(null)} aria-label={dict.common.close}>
            ✕
          </Button>
        }
      >
        {isLoading || !region ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 16 }}><Spinner /></div>
        ) : (
          <>
            <div className="pb-dim" style={{ fontSize: 12, marginBottom: 10 }}>
              {region.lat.toFixed(1)}°, {region.lon.toFixed(1)}°
              {region.freshwater ? ` · 💧 ${dict.region.freshwater}` : ""}
            </div>
            {rows.map((row) => (
              <div key={row.label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span className="pb-dim">{row.label}</span>
                  <span>{row.value}</span>
                </div>
                {row.pct !== undefined ? <Progress value={row.pct} tone={row.tone} /> : null}
              </div>
            ))}
            <Link href={`/${locale}/add?cell=${selectedCell}`}>
              <Button size="sm" variant="primary" block>
                {dict.home.addElement} ➤
              </Button>
            </Link>
          </>
        )}
      </Panel>
    </div>
  );
}
