"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Panel, Progress, Spinner } from "@kawkab/ui";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatCompact, formatNumber } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";

interface CivDetail {
  id: string;
  name: string;
  color: string;
  extinct: boolean;
  population: number;
  techEra: string;
  techKeys: string[];
  government: string;
  military: number;
  stability: number;
  happiness: number;
  health: number;
  education: number;
  economy: number;
  foodSecurity: number;
  cultureName: string;
  languageName: string;
  stockpiles: Record<string, number>;
  relations: Record<string, number>;
  cities: Array<{ id: string; name: string; population: number; isCapital: boolean; lat: number; lon: number; prosperity: number }>;
  wars: Array<{ id: string; name: string; status: string; casualties: number }>;
  alliances: Array<{ id: string; name: string; status: string; memberCivIds: string[] }>;
}

export default function CivilizationDetailPage({ params }: { params: { id: string } }) {
  const { t, locale } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const { data: civ, isLoading } = useQuery({
    queryKey: ["civ", planetId, params.id],
    queryFn: () => api<CivDetail>(`/api/worlds/${planetId}/civilizations/${params.id}`),
    enabled: !!planetId,
    refetchInterval: 30_000,
  });

  if (isLoading || !civ) return <div className="flex justify-center p-10"><Spinner /></div>;

  const meters: Array<[string, number, string]> = [
    [t("civ.stability"), civ.stability, "#34d399"],
    [t("civ.economy"), civ.economy, "#f5c452"],
    [t("civ.military"), civ.military, "#f87171"],
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="w-5 h-5 rounded-full" style={{ background: civ.color }} />
        <h1 className="text-2xl font-bold">{civ.name}</h1>
        {civ.extinct && <Badge color="#f87171">{t("civ.extinct")}</Badge>}
        <Badge color="#38bdf8">{civ.techEra}</Badge>
        <Badge color="#a78bfa">{civ.government}</Badge>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label={t("civ.population")} value={formatCompact(civ.population, locale)} />
        <Stat label={t("civ.cities")} value={String(civ.cities.length)} />
        <Stat label={t("civ.culture")} value={civ.cultureName} small />
        <Stat label={t("civ.language")} value={civ.languageName} small />
      </div>

      <Panel>
        <div className="grid sm:grid-cols-3 gap-4">
          {meters.map(([label, value, color]) => (
            <div key={label}>
              <div className="flex justify-between text-xs text-dim mb-1"><span>{label}</span><span className="tabular-nums">{Math.round(value * 100)}%</span></div>
              <Progress value={value} color={color} height={5} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title={t("civ.cities")}>
          <div className="space-y-2">
            {civ.cities.map((city) => (
              <div key={city.id} className="flex justify-between text-sm border-b border-line/50 pb-1.5">
                <span>{city.isCapital ? "★ " : ""}{city.name}</span>
                <span className="text-dim tabular-nums">{formatNumber(city.population, locale)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={t("nav.resources")}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(civ.stockpiles).map(([kind, v]) => (
              <Badge key={kind} color="#f5c452">{kind} · {Math.round((v ?? 0) * 100)}%</Badge>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title={t("civ.wars")}>
          {civ.wars.length === 0 && <span className="text-dim text-sm">—</span>}
          {civ.wars.map((war) => (
            <div key={war.id} className="text-sm border-b border-line/50 pb-1.5 mb-1.5">
              <span className={war.status === "active" ? "text-war" : "text-dim"}>{war.name}</span>
              <span className="text-dim text-xs tabular-nums"> · {formatNumber(war.casualties, locale)}</span>
            </div>
          ))}
        </Panel>
        <Panel title={t("nav.alliances")}>
          {civ.alliances.length === 0 && <span className="text-dim text-sm">—</span>}
          {civ.alliances.map((al) => (
            <div key={al.id} className="text-sm text-violet">{al.name} <span className="text-dim text-xs">({al.status})</span></div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="text-[11px] text-dim">{label}</div>
      <div className={`font-bold ${small ? "text-sm" : "text-xl"} tabular-nums`}>{value}</div>
    </div>
  );
}
