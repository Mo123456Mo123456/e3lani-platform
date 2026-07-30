"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Panel, Spinner } from "@kawkab/ui";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";

interface AllianceRow {
  id: string;
  name: string;
  memberCivIds: string[];
  status: string;
  createdTick: number;
}

interface WarRow {
  id: string;
  name: string;
  status: string;
  casualties: number;
  startedTick: number;
  endedTick: number | null;
  causeSummary: string;
}

export default function AlliancesPage() {
  const { t, locale } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const { data: alliances, isLoading } = useQuery({
    queryKey: ["alliances", planetId],
    queryFn: () => api<AllianceRow[]>(`/api/worlds/${planetId}/alliances`),
    enabled: !!planetId,
    refetchInterval: 30_000,
  });
  const { data: wars } = useQuery({
    queryKey: ["wars", planetId],
    queryFn: () => api<WarRow[]>(`/api/worlds/${planetId}/wars`),
    enabled: !!planetId,
    refetchInterval: 30_000,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">{t("nav.alliances")}</h1>
      {isLoading ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : (
        <>
          <Panel title={t("nav.alliances")}>
            {(alliances ?? []).length === 0 && <div className="text-dim text-sm">—</div>}
            <div className="space-y-2">
              {(alliances ?? []).map((al) => (
                <div key={al.id} className="flex items-center gap-3 border-b border-line/50 pb-2">
                  <span className={`w-2 h-2 rounded-full ${al.status === "active" ? "bg-violet" : "bg-dim"}`} />
                  <span className="text-sm font-medium flex-1">{al.name}</span>
                  <Badge color="#a78bfa">{al.memberCivIds.length}</Badge>
                  <span className="text-[11px] text-dim tabular-nums" dir="ltr">{t("home.year")} {formatNumber(al.createdTick, locale)}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={t("civ.wars")}>
            {(wars ?? []).length === 0 && <div className="text-dim text-sm">—</div>}
            <div className="space-y-2">
              {(wars ?? []).map((war) => (
                <div key={war.id} className="border-b border-line/50 pb-2">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${war.status === "active" ? "bg-war animate-pulse" : "bg-dim"}`} />
                    <span className="text-sm font-medium flex-1">{war.name}</span>
                    <Badge color={war.status === "active" ? "#f87171" : "#8b98a9"}>{war.status === "active" ? t("common.active") : t("common.resolved")}</Badge>
                    <span className="text-[11px] text-dim tabular-nums" dir="ltr">{formatNumber(war.casualties, locale)}</span>
                  </div>
                  <div className="text-[11px] text-dim mt-1 ms-5">{war.causeSummary}</div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
