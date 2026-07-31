"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Empty, Panel, Spinner, Stat } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";
import { describeEvent } from "@/components/EventCard";

export default function ContributionImpactPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = use(params);
  const { dict, locale } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["contribution-impact", id],
    queryFn: () => api().getContributionImpact(id),
  });

  return (
    <>
      <TopBar />
      <div className="page">
        {isLoading || !data ? (
          <Spinner />
        ) : (
          <>
            <div className="page-header">
              <h1 className="page-title">{data.contribution.name}</h1>
              <Badge tone="nature">{dict.categories[data.contribution.category]}</Badge>
            </div>

            <Panel title={dict.home.yourImpact}>
              <div className="pb-grid-stats">
                <Stat value={data.descendantEvents.length} label={dict.home.impacts} tone="tech" />
                <Stat value={data.affectedCivIds.length} label={dict.home.affectedCivs} tone="civ" />
                <Stat value={data.spreadCells.length} label={dict.dashboard.impactMap} tone="nature" />
                <Stat value={data.contribution.appliedTick ?? "—"} label={dict.home.impactAge} />
              </div>
            </Panel>

            <div style={{ height: 16 }} />
            <Panel title={dict.events.causedBy}>
              {data.descendantEvents.length === 0 ? (
                <Empty>—</Empty>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.descendantEvents.map((evt) => (
                    <Card key={evt.id} style={{ fontSize: 13 }}>
                      <Badge tone="tech">{dict.home.year} {evt.tick}</Badge>{" "}
                      {describeEvent(evt as never, locale)}
                      {evt.importance >= 4 ? <Badge tone="danger" >★</Badge> : null}
                    </Card>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
