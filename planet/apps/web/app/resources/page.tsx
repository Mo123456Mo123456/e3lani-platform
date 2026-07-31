"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DataPage, DataTable } from "@/components/DataPage";
import { useWorld } from "@/lib/useWorld";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { Badge } from "@planet/ui";

interface PlanetDetail {
  resources?: { id: string; kind: string; cell: number; quantity: number; depleted: boolean }[];
}

export default function ResourcesPage() {
  const { t } = useI18n();
  const { mode } = useWorld();
  const worldId = useWorldStore((s) => s.worldId);

  const { data } = useQuery({
    queryKey: ["planet-detail", worldId],
    queryFn: () => api<PlanetDetail>(`/worlds/${worldId}`),
    enabled: mode === "live" && !!worldId,
  });

  const byKind = React.useMemo(() => {
    const map = new Map<string, { count: number; quantity: number; depleted: number }>();
    for (const r of data?.resources ?? []) {
      const entry = map.get(r.kind) ?? { count: 0, quantity: 0, depleted: 0 };
      entry.count += 1;
      entry.quantity += r.quantity;
      if (r.depleted) entry.depleted += 1;
      map.set(r.kind, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].quantity - a[1].quantity);
  }, [data]);

  return (
    <DataPage title={t.pages.resources}>
      {mode !== "live" && <p style={{ color: "var(--planet-text-dim)", fontSize: 12 }}>{t.common.localPreview}</p>}
      <DataTable
        head={["kind", "deposits", "quantity", "depleted"]}
        rows={byKind.map(([kind, v]) => [
          <Badge key={kind} color="var(--planet-gold)">{kind}</Badge>,
          v.count,
          Math.round(v.quantity).toLocaleString(),
          v.depleted > 0 ? <Badge key="d" color="var(--planet-red)">{v.depleted}</Badge> : "0",
        ])}
      />
    </DataPage>
  );
}
