"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Empty, Panel, Progress, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";

export default function CivilizationDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = use(params);
  const { dict } = useI18n();
  const { data: planet } = useQuery({ queryKey: ["planet-current"], queryFn: () => api().getPlanet() });
  const { data: civ, isLoading } = useQuery({
    queryKey: ["civilization", planet?.id, id],
    queryFn: () => api().getCivilization(planet!.id, id),
    enabled: Boolean(planet),
  });

  if (isLoading || !civ) {
    return (
      <>
        <TopBar />
        <div className="page"><Spinner /></div>
      </>
    );
  }

  const meters: Array<{ label: string; value: number; tone: "nature" | "tech" | "civ" | "danger" }> = [
    { label: dict.common.stability, value: civ.stability, tone: civ.stability > 0.5 ? "nature" : "danger" },
    { label: dict.common.happiness, value: civ.happiness, tone: "civ" },
    { label: dict.common.health, value: civ.health, tone: "tech" },
  ];

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{civ.name}</h1>
          <Badge tone="civ">{civ.government}</Badge>
        </div>

        <div className="grid-cards">
          <Panel title={dict.dashboard.stats}>
            <div style={{ fontSize: 14, display: "grid", gap: 8 }}>
              <div>{dict.common.population}: <strong>{civ.population.toLocaleString()}</strong></div>
              <div>{dict.common.techLevel}: <strong>{civ.techLevel}</strong></div>
              <div>{dict.common.military}: <strong>{civ.military}</strong></div>
              <div>{dict.common.treasury}: <strong>{civ.treasury}</strong></div>
              <div>{dict.nav.explore}: <strong>{civ.territoryCells}</strong></div>
            </div>
            <hr className="pb-divider" />
            {meters.map((m) => (
              <div key={m.label} style={{ marginBottom: 8 }}>
                <div className="pb-label">{m.label}</div>
                <Progress value={m.value} tone={m.tone} />
              </div>
            ))}
          </Panel>

          <Panel title={`${dict.nav.explore} (${civ.cityList.length})`}>
            {civ.cityList.map((city) => (
              <Card key={city.id} style={{ marginBottom: 8, fontSize: 13 }}>
                <strong>{city.name}</strong>
                <span className="pb-dim"> · {city.population.toLocaleString()}</span>
                <div className="pb-faint" style={{ fontSize: 11 }}>
                  {dict.common.founded}: {dict.home.year} {city.foundedTick} · {city.lat.toFixed(1)}°, {city.lon.toFixed(1)}°
                </div>
              </Card>
            ))}
          </Panel>

          <Panel title={dict.nav.alliances}>
            {!civ.relationships.length ? (
              <Empty>—</Empty>
            ) : (
              civ.relationships.map((rel) => (
                <div key={rel.civId} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--pb-border)", fontSize: 13 }}>
                  <span>{rel.civName}</span>
                  <span className="pb-chip-row">
                    {rel.atWar ? <Badge tone="danger">⚔</Badge> : null}
                    {rel.allied ? <Badge tone="nature">🤝</Badge> : null}
                    {rel.trade ? <Badge tone="tech">⇄</Badge> : null}
                    <Badge>{Math.round(rel.trust * 100)}%</Badge>
                  </span>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
