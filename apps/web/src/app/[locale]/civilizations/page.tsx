"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Panel, Progress, Spinner } from "@kawkab/ui";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatCompact } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";

interface CivRow {
  id: string;
  name: string;
  color: string;
  extinct: boolean;
  population: number;
  territorySize: number;
  techEra: string;
  government: string;
  stability: number;
  economy: number;
  military: number;
  cities: number;
}

export default function CivilizationsPage() {
  const { t, locale } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const { data, isLoading } = useQuery({
    queryKey: ["civs", planetId],
    queryFn: () => api<CivRow[]>(`/api/worlds/${planetId}/civilizations`),
    enabled: !!planetId,
    refetchInterval: 30_000,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">{t("nav.civilizations")}</h1>
      {isLoading ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data ?? []).map((civ) => (
            <Link key={civ.id} href={`/${locale}/civilizations/${civ.id}`}>
              <div className="rounded-lg border border-line bg-panel hover:bg-panelAlt p-3 transition-colors h-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: civ.color }} />
                  <span className="font-semibold text-sm flex-1">{civ.name}</span>
                  {civ.extinct && <Badge color="#f87171">{t("civ.extinct")}</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-[11px] text-dim mb-2">
                  <span>{t("civ.population")}<br /><b className="text-white tabular-nums">{formatCompact(civ.population, locale)}</b></span>
                  <span>{t("civ.cities")}<br /><b className="text-white tabular-nums">{civ.cities}</b></span>
                  <span>{t("civ.era")}<br /><b className="text-white">{civ.techEra}</b></span>
                </div>
                <Meter label={t("civ.stability")} value={civ.stability} color="#34d399" />
                <Meter label={t("civ.economy")} value={civ.economy} color="#f5c452" />
                <Meter label={t("civ.military")} value={civ.military} color="#f87171" />
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="hidden"><Panel /></div>
    </div>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-1">
      <div className="flex justify-between text-[10px] text-dim"><span>{label}</span><span className="tabular-nums">{Math.round(value * 100)}%</span></div>
      <Progress value={value} color={color} height={3} />
    </div>
  );
}
