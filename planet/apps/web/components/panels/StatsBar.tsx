"use client";

import React from "react";
import { Stat } from "@planet/ui";
import { useI18n } from "@/lib/i18n";
import { useWorldStore } from "@/lib/store";

export function StatsBar() {
  const { t } = useI18n();
  const snapshot = useWorldStore((s) => s.snapshot);
  if (!snapshot) return null;
  const s = snapshot.stats;

  return (
    <div
      style={{
        position: "absolute", top: 64, insetInlineEnd: 16, zIndex: 30,
        display: "flex", gap: 16, background: "rgba(5,10,20,0.65)",
        border: "1px solid var(--planet-border)", borderRadius: 10,
        padding: "8px 14px", backdropFilter: "blur(8px)",
      }}
    >
      <Stat label={t.stats.civs} value={s.civs} color="var(--planet-gold)" />
      <Stat label={t.stats.cities} value={s.cities} />
      <Stat label={t.stats.plants} value={s.plants} color="var(--planet-green)" />
      <Stat label={t.stats.species} value={s.species} color="var(--planet-green)" />
      <Stat label={t.stats.techs} value={s.technologies} color="var(--planet-accent)" />
      <Stat label={t.stats.wars} value={s.activeWars} color={s.activeWars > 0 ? "var(--planet-red)" : undefined} />
    </div>
  );
}
