"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Empty, Panel, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";

export default function AlliancesPage() {
  const { dict } = useI18n();
  const { data: planet } = useQuery({ queryKey: ["planet-current"], queryFn: () => api().getPlanet() });
  const { data: alliances, isLoading: loadingA } = useQuery({
    queryKey: ["alliances", planet?.id],
    queryFn: () => api().getAlliances(planet!.id),
    enabled: Boolean(planet),
  });
  const { data: wars, isLoading: loadingW } = useQuery({
    queryKey: ["wars", planet?.id],
    queryFn: () => api().getWars(planet!.id),
    enabled: Boolean(planet),
  });

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{dict.nav.alliances}</h1>
        </div>
        <div className="grid-cards">
          <Panel title={`${dict.nav.alliances} (${alliances?.length ?? 0})`}>
            {loadingA ? (
              <Spinner />
            ) : !(alliances ?? []).length ? (
              <Empty>—</Empty>
            ) : (
              (alliances ?? []).map((al) => (
                <Card key={al.id} style={{ marginBottom: 8, opacity: al.active ? 1 : 0.5 }}>
                  <Badge tone={al.active ? "nature" : "danger"}>{al.active ? dict.common.active : dict.common.extinct}</Badge>{" "}
                  <strong>{al.memberNames.join(" × ")}</strong>
                  <div className="pb-faint" style={{ fontSize: 11, marginTop: 4 }}>
                    {dict.common.founded}: {dict.home.year} {al.formedTick}
                  </div>
                </Card>
              ))
            )}
          </Panel>
          <Panel title={`${dict.overlays.wars} (${wars?.filter((w) => w.active).length ?? 0})`}>
            {loadingW ? (
              <Spinner />
            ) : !(wars ?? []).length ? (
              <Empty>—</Empty>
            ) : (
              (wars ?? []).map((war) => (
                <Card key={war.id} style={{ marginBottom: 8, opacity: war.active ? 1 : 0.6 }}>
                  <Badge tone={war.active ? "danger" : undefined}>⚔</Badge>{" "}
                  <strong>{war.attackerName} × {war.defenderName}</strong>
                  <div className="pb-dim" style={{ fontSize: 12, marginTop: 4 }}>
                    {dict.home.year} {war.startTick} · {dict.events.causes}:{" "}
                    {war.causes.slice(0, 3).map((c) => c.factor).join(", ")}
                  </div>
                </Card>
              ))
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
