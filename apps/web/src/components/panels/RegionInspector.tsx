"use client";

import { useRouter } from "next/navigation";
import { Progress, Button } from "@kawkab/ui";
import { useWorldStore } from "@/lib/store";
import { formatNumber, formatTemp } from "@/lib/format";
import { useT } from "../LocaleProvider";
import type { MessageKey } from "@/i18n";

/** right-hand card with live data of the clicked region */
export function RegionInspector() {
  const { t, locale } = useT();
  const router = useRouter();
  const data = useWorldStore((s) => s.selectedRegionData);
  const selected = useWorldStore((s) => s.selectedRegion);
  const selectRegion = useWorldStore((s) => s.selectRegion);

  if (selected === null) return null;
  return (
    <div className="absolute bottom-4 inset-x-4 sm:inset-x-auto sm:end-4 sm:w-80 z-20 rounded-lg border border-line bg-panel/95 backdrop-blur p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">{t("region.title")}</span>
        <button className="text-dim hover:text-white text-xs" onClick={() => selectRegion(null, null)}>
          ✕
        </button>
      </div>
      {!data ? (
        <div className="text-dim text-xs">{t("loading")}</div>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-dim">{t("region.biome")}</span>
            <span>{t(`biome.${data.biome}` as MessageKey)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">{t("region.temperature")}</span>
            <span className="tabular-nums">{formatTemp(data.temperature)}</span>
          </div>
          <Meter label={t("region.moisture")} value={data.moisture} color="#38bdf8" />
          <Meter label={t("region.fertility")} value={data.fertility} color="#34d399" />
          <Meter label={t("region.pollution")} value={data.pollution} color="#fb923c" />
          {data.river > 0.05 && (
            <div className="flex justify-between">
              <span className="text-dim">{t("region.river")}</span>
              <span className="tabular-nums">{Math.round(data.river * 100)}%</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-dim">{t("region.population")}</span>
            <span className="tabular-nums">{formatNumber(data.population, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">{t("region.owner")}</span>
            <span style={{ color: "#f5c452" }}>{data.civName ?? t("region.unclaimed")}</span>
          </div>
          {data.cityName && (
            <div className="flex justify-between">
              <span className="text-dim">{t("region.city")}</span>
              <span>{data.cityName}</span>
            </div>
          )}
          {data.isVolcanic && <div className="text-hazard">🌋 {t("region.volcanic")}</div>}
          {data.resources.length > 0 && (
            <div>
              <div className="text-dim mb-1">{t("region.resources")}</div>
              <div className="flex flex-wrap gap-1">
                {data.resources.map((r) => (
                  <span key={r.kind} className="px-1.5 py-0.5 rounded bg-civ/15 text-civ text-[10px]">
                    {r.kind} · {Math.round(r.amount * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
          <Button
            variant="primary"
            style={{ width: "100%", marginTop: 6 }}
            onClick={() => router.push(`/${locale}/contribute?origin=${data.index}`)}
          >
            {t("region.addHere")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-dim">{label}</span>
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <Progress value={value} color={color} height={4} />
    </div>
  );
}
