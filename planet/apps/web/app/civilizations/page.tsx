"use client";

import React from "react";
import { Badge } from "@planet/ui";
import { DataPage, DataTable } from "@/components/DataPage";
import { useWorld } from "@/lib/useWorld";
import { useI18n } from "@/lib/i18n";

export default function CivilizationsPage() {
  const { t } = useI18n();
  const { bundle } = useWorld();

  const rows = (bundle?.snapshot.civs ?? [])
    .slice()
    .sort((a, b) => b.population - a.population)
    .map((c) => [
      <strong key="n" style={{ color: c.fallen ? "var(--planet-text-dim)" : "var(--planet-gold)" }}>{c.name}</strong>,
      c.population.toLocaleString(),
      `T${c.techLevel}`,
      c.government,
      c.culture,
      c.language,
      `${Math.round(c.stability * 100)}%`,
      `${Math.round(c.economy * 100)}%`,
      c.fallen ? <Badge key="s" color="var(--planet-red)">fallen</Badge> : <Badge key="s" color="var(--planet-green)">alive</Badge>,
    ]);

  return (
    <DataPage title={t.pages.civilizations}>
      <DataTable
        head={[t.nav.civilizations, t.stats.population, t.nav.tech, "gov", "culture", "lang", "stability", "economy", ""]}
        rows={rows}
      />
    </DataPage>
  );
}
