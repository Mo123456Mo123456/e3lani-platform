"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Empty, Panel, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";

interface ResourceRow {
  id: string;
  name: string;
  kind: string;
  baseValue: number;
  regen: number;
  envImpact: number;
  totalQuantity: number;
  deposits: number;
  contributionId: string | null;
}

export default function ResourcesPage() {
  const { dict } = useI18n();
  const { data: planet } = useQuery({ queryKey: ["planet-current"], queryFn: () => api().getPlanet() });
  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources", planet?.id],
    queryFn: () => api().get<ResourceRow[]>(`/planets/${planet!.id}/resources`),
    enabled: Boolean(planet),
  });

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{dict.nav.resources}</h1>
          <Badge tone="tech">{resources?.length ?? 0}</Badge>
        </div>
        {isLoading ? (
          <Spinner />
        ) : !(resources ?? []).length ? (
          <Empty>—</Empty>
        ) : (
          <div className="grid-cards">
            {(resources ?? []).map((res) => (
              <Card key={res.id}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{res.name}</strong>
                  <Badge tone={res.regen > 0 ? "nature" : "warning"}>{res.kind}</Badge>
                </div>
                <div className="pb-dim" style={{ fontSize: 12, marginTop: 6 }}>
                  value: {res.baseValue.toFixed(1)} · deposits: {res.deposits} · total: {Math.round(res.totalQuantity)}
                </div>
                {res.contributionId ? <Badge tone="civ">★ user</Badge> : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
