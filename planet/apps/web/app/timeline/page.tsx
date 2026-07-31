"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataPage } from "@/components/DataPage";
import { useWorld } from "@/lib/useWorld";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useEventsStore, useWorldStore } from "@/lib/store";
import { Badge, Panel, Button } from "@planet/ui";

/** Full timeline: eras, major events, era-vs-era comparison. */
export default function TimelinePage() {
  const { t } = useI18n();
  const { mode } = useWorld();
  const worldId = useWorldStore((s) => s.worldId);
  const liveEvents = useEventsStore((s) => s.events);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  const { data: timeline } = useQuery({
    queryKey: ["timeline", worldId],
    queryFn: () => api<{ tick: number; year: number; state: { stats?: { civs?: number; events?: number } } }[]>(`/worlds/${worldId}/timeline`),
    enabled: mode === "live" && !!worldId,
  });

  const { data: majorEvents } = useQuery({
    queryKey: ["major-events", worldId],
    queryFn: async () => {
      const types = ["CIVILIZATION_FOUNDED", "WAR_STARTED", "TECHNOLOGY_DISCOVERED", "ERA_STARTED", "SPECIES_EXTINCT"];
      const pages = await Promise.all(
        types.map((type) => api<{ events: { seq: number; year: number; type: string; payload: Record<string, unknown> }[] }>(`/worlds/${worldId}/events?type=${type}&limit=12`)),
      );
      return pages.flatMap((p) => p.events).sort((a, b) => a.year - b.year);
    },
    enabled: mode === "live" && !!worldId,
  });

  const eventsToShow = majorEvents ?? liveEvents.filter((e) => e.importance > 0.6).slice(0, 60);
  const snapA = timeline?.find((s) => s.tick === compareA);
  const snapB = timeline?.find((s) => s.tick === compareB);

  return (
    <DataPage title={t.pages.timeline}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {timeline && timeline.length > 1 && (
          <Panel title={t.timelineBar.compare}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select className="input" style={{ width: 150 }} value={compareA ?? ""} onChange={(e) => setCompareA(Number(e.target.value) || null)}>
                <option value="">—</option>
                {timeline.map((s) => <option key={s.tick} value={s.tick}>{t.dashboard.year} {s.year}</option>)}
              </select>
              <span>×</span>
              <select className="input" style={{ width: 150 }} value={compareB ?? ""} onChange={(e) => setCompareB(Number(e.target.value) || null)}>
                <option value="">—</option>
                {timeline.map((s) => <option key={s.tick} value={s.tick}>{t.dashboard.year} {s.year}</option>)}
              </select>
              {snapA && snapB && (
                <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                  <span>{t.stats.civs}: {(snapA.state.stats?.civs ?? 0)} → {(snapB.state.stats?.civs ?? 0)}</span>
                  <span>{t.dashboard.effects}: {(snapA.state.stats?.events ?? 0)} → {(snapB.state.stats?.events ?? 0)}</span>
                </div>
              )}
            </div>
          </Panel>
        )}

        <Panel title={t.timelineBar.title}>
          <div style={{ position: "relative", paddingInlineStart: 20 }}>
            <div style={{ position: "absolute", insetInlineStart: 6, top: 0, bottom: 0, width: 2, background: "var(--planet-border)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {eventsToShow.map((e) => (
                <div key={e.seq} style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute", insetInlineStart: -18, top: 4, width: 9, height: 9,
                      borderRadius: "50%", background: "var(--planet-accent)",
                      border: "2px solid var(--planet-bg)",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 11, color: "var(--planet-text-dim)", width: 70 }}>{t.dashboard.year} {e.year}</span>
                    <Badge>{t.events[e.type as keyof typeof t.events] ?? e.type}</Badge>
                    <span style={{ fontSize: 12, color: "var(--planet-text-dim)" }}>
                      {String(e.payload["name"] ?? e.payload["attacker"] ?? e.payload["era"] ?? "")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </DataPage>
  );
}
