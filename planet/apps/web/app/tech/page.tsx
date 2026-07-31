"use client";

import React from "react";
import { DataPage } from "@/components/DataPage";
import { useWorld } from "@/lib/useWorld";
import { useI18n } from "@/lib/i18n";
import { Badge, Panel } from "@planet/ui";

export default function TechPage() {
  const { t } = useI18n();
  const { bundle } = useWorld();

  const techs = React.useMemo(() => {
    const events = bundle?.events ?? [];
    return events
      .filter((e) => e.type === "TECHNOLOGY_DISCOVERED")
      .sort((a, b) => b.year - a.year)
      .slice(0, 60);
  }, [bundle]);

  const maxTier = Math.max(1, ...(bundle?.snapshot.civs ?? []).map((c) => c.techLevel));

  return (
    <DataPage title={t.pages.tech}>
      <Panel title={`${t.nav.tech} · max tier ${maxTier}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {techs.length === 0 && <p style={{ color: "var(--planet-text-dim)", fontSize: 12 }}>{t.common.noData}</p>}
          {techs.map((e) => (
            <div key={e.seq} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{String((e.payload as { name?: string }).name ?? "")}</span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Badge>T{(e.payload as { tier?: number }).tier ?? 0}</Badge>
                <span style={{ fontSize: 11, color: "var(--planet-text-dim)" }}>{t.dashboard.year} {e.year}</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </DataPage>
  );
}
