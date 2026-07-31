"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@planet/ui";
import { DataPage, DataTable } from "@/components/DataPage";
import { useWorld } from "@/lib/useWorld";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";

interface SpeciesRow {
  id: number;
  name: string;
  kind: string;
  population: number;
  diet: string;
  size: number;
  contributionId?: string;
}

export default function SpeciesPage() {
  const { t } = useI18n();
  const { mode } = useWorld();
  const worldId = useWorldStore((s) => s.worldId);

  const { data } = useQuery({
    queryKey: ["species", worldId],
    queryFn: () => api<SpeciesRow[]>(`/worlds/${worldId}/species`),
    enabled: mode === "live" && !!worldId,
  });

  const rows = (data ?? [])
    .slice()
    .sort((a, b) => b.population - a.population)
    .slice(0, 200)
    .map((s) => [
      s.name,
      s.kind,
      s.diet,
      s.population.toLocaleString(),
      s.contributionId ? <Badge key="c" color="#22d3ee">user</Badge> : "",
    ]);

  return (
    <DataPage title={t.pages.species}>
      {mode !== "live" && <p style={{ color: "var(--planet-text-dim)", fontSize: 12 }}>{t.common.localPreview}</p>}
      <DataTable head={["name", "kind", "diet", t.stats.population, ""]} rows={rows} />
    </DataPage>
  );
}
