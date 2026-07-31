"use client";

import React, { useMemo, useState } from "react";
import type { WorldEvent, WorldEventType } from "@planet/shared-types";
import { Panel, Badge, EmptyState } from "@planet/ui";
import { useI18n } from "@/lib/i18n";
import { useEventsStore, useUiStore, useWorldStore } from "@/lib/store";

const EVENT_COLORS: Partial<Record<WorldEventType, string>> = {
  WAR_STARTED: "var(--planet-red)",
  WAR_ENDED: "var(--planet-red)",
  CITY_FALLEN: "var(--planet-red)",
  VOLCANO_ERUPTED: "var(--planet-orange)",
  WILDFIRE_STARTED: "var(--planet-orange)",
  DISEASE_OUTBREAK: "var(--planet-orange)",
  FLOOD_OCCURRED: "var(--planet-orange)",
  SPECIES_EXTINCT: "var(--planet-red)",
  SPECIES_CREATED: "var(--planet-green)",
  PLANT_SPREAD: "var(--planet-green)",
  CIVILIZATION_FOUNDED: "var(--planet-gold)",
  CITY_CREATED: "var(--planet-gold)",
  TECHNOLOGY_DISCOVERED: "var(--planet-gold)",
  ALLIANCE_CREATED: "var(--planet-purple)",
  MIGRATION_STARTED: "var(--planet-purple)",
  TRADE_ROUTE_CREATED: "var(--planet-accent)",
  RESOURCE_DISCOVERED: "var(--planet-accent)",
  CONTRIBUTION_APPLIED: "#22d3ee",
  ERA_STARTED: "#e879f9",
};

function eventSummary(e: WorldEvent, t: ReturnType<typeof useI18n>["t"]): string {
  const p = e.payload as Record<string, unknown>;
  const name = (p["name"] as string) ?? (p["city"] as string) ?? (p["civ"] as string) ?? "";
  switch (e.type) {
    case "WAR_STARTED": return `${p["attacker"] ?? ""} × ${p["defender"] ?? ""}`;
    case "WAR_ENDED": return `${t.events.WAR_ENDED} — ${p["victor"] ?? ""}`;
    case "TRADE_ROUTE_CREATED": return `${p["from"] ?? ""} ↔ ${p["to"] ?? ""}`;
    case "CONTRIBUTION_APPLIED": return name || String(p["category"] ?? "");
    default: return name;
  }
}

export function EventFeed() {
  const { t, locale } = useI18n();
  const { events, total, connected } = useEventsStore();
  const [filter, setFilter] = useState<string | null>(null);
  const selectCell = useUiStore((s) => s.selectCell);
  const mode = useWorldStore((s) => s.mode);

  const filtered = useMemo(
    () => (filter ? events.filter((e) => e.type === filter) : events),
    [events, filter],
  );
  const topTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events.slice(0, 300)) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type]) => type);
  }, [events]);

  return (
    <Panel
      title={t.dashboard.liveEvents}
      right={
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--planet-text-dim)" }}>
          <span
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: connected || mode === "local-preview" ? "var(--planet-green)" : "var(--planet-text-dim)",
              animation: "planet-pulse 2s infinite",
            }}
          />
          {connected ? t.common.connected : mode === "local-preview" ? t.common.localPreview.split("—")[0] : t.common.disconnected}
        </span>
      }
      style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
    >
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        <button className={`chip ${filter === null ? "active" : ""}`} onClick={() => setFilter(null)}>
          {t.common.viewAll} ({total || events.length})
        </button>
        {topTypes.map((type) => (
          <button key={type} className={`chip ${filter === type ? "active" : ""}`} onClick={() => setFilter(type)}>
            {t.events[type as WorldEventType] ?? type}
          </button>
        ))}
      </div>

      <div className="panel-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 && <EmptyState>{t.common.noData}</EmptyState>}
        {filtered.slice(0, 120).map((e) => (
          <div
            key={e.seq}
            className="event-item"
            onClick={() => e.cellIndex !== undefined && selectCell(e.cellIndex)}
          >
            <span className="event-dot" style={{ background: EVENT_COLORS[e.type] ?? "var(--planet-text-dim)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {t.events[e.type] ?? e.type}
                </span>
                <span style={{ fontSize: 10, color: "var(--planet-text-dim)", whiteSpace: "nowrap" }}>
                  {t.dashboard.year} {e.year}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--planet-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {eventSummary(e, t)}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                {e.importance > 0.7 && <Badge color="var(--planet-red)">{locale === "ar" ? "مهم" : "major"}</Badge>}
                {e.contributionId && <Badge color="#22d3ee">{locale === "ar" ? "أثر مستخدم" : "user impact"}</Badge>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
