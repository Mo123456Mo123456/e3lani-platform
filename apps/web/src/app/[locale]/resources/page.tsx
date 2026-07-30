"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Panel, Progress, Spinner } from "@kawkab/ui";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";

interface RouteRow {
  id: string;
  goods: string[];
  value: number;
  risk: number;
  active: boolean;
  createdTick: number;
}

interface RegionRow {
  resources: Array<{ kind: string; amount: number }>;
}

export default function ResourcesPage() {
  const { t, locale } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes", planetId],
    queryFn: () => api<RouteRow[]>(`/api/worlds/${planetId}/trade-routes`),
    enabled: !!planetId,
  });
  const { data: resourceLayer } = useQuery({
    queryKey: ["layer", planetId, "resource"],
    queryFn: () => api<{ cells: Array<{ index: number; value: number }> }>(`/api/worlds/${planetId}/layers/resource`),
    enabled: !!planetId,
  });

  const richCells = (resourceLayer?.cells ?? []).filter((c) => c.value > 0.4).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">{t("nav.resources")}</h1>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="rounded-lg border border-line bg-panel p-3 text-center">
          <div className="text-[11px] text-dim">{t("legend.resources")}</div>
          <div className="text-xl font-bold text-civ tabular-nums">{formatNumber(richCells, locale)}</div>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3 text-center">
          <div className="text-[11px] text-dim">{t("legend.trade")}</div>
          <div className="text-xl font-bold text-tech tabular-nums">{formatNumber((routes ?? []).filter((r) => r.active).length, locale)}</div>
        </div>
      </div>

      <Panel title={t("legend.trade")}>
        {isLoading ? (
          <Spinner />
        ) : (routes ?? []).length === 0 ? (
          <div className="text-dim text-sm">—</div>
        ) : (
          <div className="space-y-2">
            {(routes ?? []).map((route) => (
              <div key={route.id} className="flex items-center gap-3 border-b border-line/50 pb-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${route.active ? "bg-nature" : "bg-war"}`} />
                <div className="flex gap-1 flex-wrap">
                  {route.goods.map((g) => (
                    <Badge key={g} color="#f5c452">{g}</Badge>
                  ))}
                </div>
                <div className="flex-1" />
                <div className="w-28">
                  <div className="text-[10px] text-dim">value</div>
                  <Progress value={route.value} color="#34d399" height={4} />
                </div>
                <div className="w-28">
                  <div className="text-[10px] text-dim">risk</div>
                  <Progress value={route.risk} color="#f87171" height={4} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
