"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Empty, Panel, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";
import { EventCard } from "@/components/EventCard";

export default function TimelinePage() {
  const { dict } = useI18n();
  const { data: planet } = useQuery({ queryKey: ["planet-current"], queryFn: () => api().getPlanet() });
  const { data: timeline } = useQuery({
    queryKey: ["timeline", planet?.id],
    queryFn: () => api().getTimeline(planet!.id),
    enabled: Boolean(planet),
  });
  const { data: snapshots } = useQuery({
    queryKey: ["snapshots", planet?.id],
    queryFn: () => api().getSnapshots(planet!.id),
    enabled: Boolean(planet),
  });
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [compare, setCompare] = useState<Record<string, number> | null>(null);
  const [eraEvents, setEraEvents] = useState<{ from: number; to: number } | null>(null);

  const { data: events } = useQuery({
    queryKey: ["era-events", planet?.id, eraEvents],
    queryFn: () =>
      api().getEvents(planet!.id, {
        fromTick: eraEvents!.from,
        toTick: eraEvents!.to,
        minImportance: 3,
        pageSize: 30,
      }),
    enabled: Boolean(planet) && Boolean(eraEvents),
  });

  async function runCompare() {
    if (from === null || to === null || !planet) return;
    const res = await api().compareSnapshots(planet.id, from, to);
    setCompare(res.deltas);
  }

  const maxCount = Math.max(1, ...(timeline?.eras ?? []).map((e) => e.eventCount));

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{dict.timelinePage.title}</h1>
        </div>

        <Panel title={dict.home.year}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
            {(timeline?.eras ?? []).map((era) => (
              <div
                key={era.fromTick}
                title={`${era.fromTick}–${era.toTick}: ${era.eventCount}`}
                onClick={() => setEraEvents({ from: era.fromTick, to: era.toTick })}
                style={{
                  flex: 1,
                  height: `${(era.eventCount / maxCount) * 100}%`,
                  minHeight: 6,
                  background: "linear-gradient(180deg, rgba(56,189,248,.7), rgba(56,189,248,.15))",
                  borderRadius: "4px 4px 0 0",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
          <div className="pb-faint" style={{ fontSize: 11, marginTop: 6 }}>
            0 ← {planet?.tick ?? 0} {dict.common.era}
          </div>
        </Panel>

        <div style={{ height: 16 }} />
        <Panel title={dict.timelinePage.compare}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <select className="pb-select" style={{ width: 160 }} value={from ?? ""} onChange={(e) => setFrom(Number(e.target.value))}>
              <option value="">{dict.timelinePage.from}</option>
              {(snapshots ?? []).map((s) => (
                <option key={s.tick} value={s.tick}>{dict.home.year} {s.tick}</option>
              ))}
            </select>
            <select className="pb-select" style={{ width: 160 }} value={to ?? ""} onChange={(e) => setTo(Number(e.target.value))}>
              <option value="">{dict.timelinePage.to}</option>
              {(snapshots ?? []).map((s) => (
                <option key={s.tick} value={s.tick}>{dict.home.year} {s.tick}</option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={runCompare} disabled={from === null || to === null}>
              {dict.timelinePage.compare}
            </Button>
          </div>
          {compare ? (
            <div className="grid-cards" style={{ marginTop: 14 }}>
              {Object.entries(compare).map(([key, delta]) => (
                <Card key={key}>
                  <div className="pb-dim" style={{ fontSize: 12 }}>{key}</div>
                  <div className="pb-mono" style={{ fontSize: 18, color: delta >= 0 ? "var(--pb-nature)" : "var(--pb-danger)" }}>
                    {delta >= 0 ? "+" : ""}{typeof delta === "number" ? Math.round(delta * 100) / 100 : delta}
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </Panel>

        {eraEvents ? (
          <>
            <div style={{ height: 16 }} />
            <Panel
              title={`${dict.timelinePage.eventsInEra}: ${eraEvents.from}–${eraEvents.to}`}
              actions={<button className="hud-chip" onClick={() => setEraEvents(null)}>✕</button>}
            >
              {!events ? (
                <Spinner />
              ) : !events.items.length ? (
                <Empty>—</Empty>
              ) : (
                events.items.map((evt) => <EventCard key={evt.id} evt={evt} />)
              )}
            </Panel>
          </>
        ) : null}
      </div>
    </>
  );
}
