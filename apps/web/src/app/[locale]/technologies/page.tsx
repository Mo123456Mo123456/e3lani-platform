"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Empty, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";

export default function TechnologiesPage() {
  const { dict } = useI18n();
  const { data: planet } = useQuery({ queryKey: ["planet-current"], queryFn: () => api().getPlanet() });
  const { data: techs, isLoading } = useQuery({
    queryKey: ["technologies", planet?.id],
    queryFn: () => api().getTechnologies(planet!.id),
    enabled: Boolean(planet),
  });

  const byTier = new Map<number, typeof techs>();
  for (const t of techs ?? []) {
    byTier.set(t.tier, [...(byTier.get(t.tier) ?? []), t]);
  }

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{dict.nav.technologies}</h1>
          <Badge tone="tech">{techs?.length ?? 0}</Badge>
        </div>
        {isLoading ? (
          <Spinner />
        ) : !(techs ?? []).length ? (
          <Empty>—</Empty>
        ) : (
          [...byTier.entries()].sort((a, b) => a[0] - b[0]).map(([tier, items]) => (
            <div key={tier} style={{ marginBottom: 20 }}>
              <div className="pb-label">Tier {tier}</div>
              <div className="grid-cards">
                {(items ?? []).map((t) => (
                  <Card key={t.id}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{t.name}</strong>
                      {t.contributionId ? <Badge tone="civ">★</Badge> : null}
                    </div>
                    <div className="pb-dim" style={{ fontSize: 12, marginTop: 4 }}>
                      {t.discoveredByName ?? "—"} · {dict.home.year} {t.tick ?? 0}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
