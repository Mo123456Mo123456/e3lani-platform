"use client";

import React, { useEffect, useState } from "react";
import type { RegionInfo } from "@planet/shared-types";
import { Panel, Badge, Button, Spinner } from "@planet/ui";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useUiStore, useWorldStore } from "@/lib/store";

const BIOME_AR: Record<string, string> = {
  ocean: "محيط", coast: "ساحل", plains: "سهول", rainforest: "غابة مطيرة",
  temperate_forest: "غابة معتدلة", desert: "صحراء", mountains: "جبال",
  tundra: "تندرا", swamp: "مستنقع", steppe: "سهوب", volcanic: "بركانية", ice: "جليد",
};

export function RegionPanel() {
  const { t, locale } = useI18n();
  const { selectedCell, region, selectCell, wizardPickMode } = useUiStore();
  const { worldId, mode } = useWorldStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCell === null || mode !== "live" || !worldId) return;
    let cancelled = false;
    setLoading(true);
    api<RegionInfo>(`/worlds/${worldId}/regions/${selectedCell}`)
      .then((info) => {
        if (!cancelled) selectCell(selectedCell, info);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedCell, worldId, mode, selectCell]);

  if (selectedCell === null) return null;
  const r = region;

  return (
    <div
      style={{
        position: "absolute", bottom: 90, insetInlineStart: 16, width: 260, zIndex: 30,
      }}
    >
      <Panel
        title={t.region.title}
        right={
          <button className="chip" onClick={() => selectCell(null)}>
            {t.common.close}
          </button>
        }
      >
        {loading && <Spinner />}
        {!loading && !r && (
          <p style={{ fontSize: 12, color: "var(--planet-text-dim)" }}>
            {t.region.title} #{selectedCell}
          </p>
        )}
        {r && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
            <Row label={t.region.biome} value={locale === "ar" ? BIOME_AR[r.biome] ?? r.biome : r.biome} />
            <Row label={t.region.temp} value={`${Math.round(r.temperature * 45)}°`} />
            <Row label={t.region.moisture} value={`${Math.round(r.moisture * 100)}%`} />
            <Row label={t.region.fertility} value={`${Math.round(r.fertility * 100)}%`} />
            <Row label={t.region.pollution} value={`${Math.round(r.pollution * 100)}%`} />
            {r.river && <Badge color="var(--planet-accent)">{t.region.river}</Badge>}
            {r.resources.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {r.resources.map((res) => (
                  <Badge key={res.kind} color="var(--planet-gold)">{res.kind} ×{res.quantity}</Badge>
                ))}
              </div>
            )}
            <Row label={t.region.plantsHere} value={String(r.plantCount)} />
            <Row label={t.region.speciesHere} value={String(r.speciesCount)} />
            {wizardPickMode && (
              <Button style={{ marginTop: 4 }}>{t.region.pickHere} ✓</Button>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--planet-text-dim)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
