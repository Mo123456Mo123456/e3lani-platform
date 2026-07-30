"use client";

import { useWorldStore } from "@/lib/store";
import { formatCompact } from "@/lib/format";
import { useT } from "../LocaleProvider";
import type { MessageKey } from "@/i18n";

export function StatsStrip() {
  const { t, locale } = useT();
  const stats = useWorldStore((s) => s.stats);
  if (!stats) return null;
  const rows: Array<{ key: MessageKey; value: string; color?: string }> = [
    { key: "stats.civilizations", value: formatCompact(stats.civilizations, locale), color: "#f5c452" },
    { key: "stats.cities", value: formatCompact(stats.cities, locale), color: "#f5c452" },
    { key: "stats.species", value: formatCompact(stats.species, locale), color: "#34d399" },
    { key: "stats.plants", value: formatCompact(stats.plants, locale), color: "#34d399" },
    { key: "stats.population", value: formatCompact(stats.totalPopulation, locale) },
    { key: "stats.temperature", value: `${stats.meanTemperature.toFixed(1)}°` },
    { key: "stats.pollution", value: `${(stats.meanPollution * 100).toFixed(1)}%`, color: stats.meanPollution > 0.3 ? "#fb923c" : undefined },
    { key: "stats.wars", value: formatCompact(stats.activeWars, locale), color: stats.activeWars > 0 ? "#f87171" : undefined },
    { key: "stats.trade", value: formatCompact(stats.tradeRoutes, locale), color: "#38bdf8" },
  ];
  return (
    <div className="flex gap-4 px-3 py-2 overflow-x-auto border-t border-line bg-panel/80 text-center">
      {rows.map((row) => (
        <div key={row.key} className="min-w-[64px]">
          <div className="text-[10px] text-dim whitespace-nowrap">{t(row.key)}</div>
          <div className="text-sm font-bold tabular-nums" style={{ color: row.color ?? "#e6edf3" }}>
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}
