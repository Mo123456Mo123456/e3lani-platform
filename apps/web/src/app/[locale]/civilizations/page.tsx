"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Empty, Panel, Progress, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";

export default function CivilizationsPage() {
  const { locale, dict } = useI18n();
  const { data: planet } = useQuery({ queryKey: ["planet-current"], queryFn: () => api().getPlanet() });
  const { data: civs, isLoading } = useQuery({
    queryKey: ["civilizations", planet?.id],
    queryFn: () => api().getCivilizations(planet!.id),
    enabled: Boolean(planet),
  });

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{dict.nav.civilizations}</h1>
          <Badge tone="civ">{civs?.length ?? 0}</Badge>
        </div>
        {isLoading ? (
          <Spinner />
        ) : !(civs ?? []).length ? (
          <Empty>—</Empty>
        ) : (
          <div className="grid-cards">
            {(civs ?? []).map((civ) => (
              <Link key={civ.id} href={`/${locale}/civilizations/${civ.id}`} style={{ textDecoration: "none" }}>
                <Card clickable style={{ opacity: civ.extinct ? 0.5 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{civ.name}</strong>
                    {civ.extinct ? <Badge tone="danger">{dict.common.extinct}</Badge> : <Badge tone="civ">T{civ.techLevel}</Badge>}
                  </div>
                  <div className="pb-dim" style={{ fontSize: 12, margin: "6px 0" }}>
                    {civ.culture} · {civ.language} · {civ.government}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    {dict.common.population}: <strong>{civ.population.toLocaleString()}</strong> · {dict.nav.explore}: {civ.cities}
                  </div>
                  <div className="pb-label">{dict.common.stability}</div>
                  <Progress value={civ.stability} tone={civ.stability > 0.5 ? "nature" : "danger"} />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
