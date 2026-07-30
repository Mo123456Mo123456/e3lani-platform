"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TimelineEntry } from "@kawkab/shared-types";
import { eventColorOf } from "@kawkab/ui";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { useT } from "../LocaleProvider";

/** bottom timeline: scrub through the world's event history */
export function TimelineBar() {
  const { t, locale } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const simYear = useWorldStore((s) => s.simYear);
  const cursor = useWorldStore((s) => s.timelineCursor);
  const setCursor = useWorldStore((s) => s.setTimelineCursor);

  const { data: entries } = useQuery({
    queryKey: ["timeline", planetId],
    queryFn: () => api<TimelineEntry[]>(`/api/planets/${planetId}/events/timeline?limit=300`),
    enabled: !!planetId,
    refetchInterval: 60_000,
  });

  const minYear = entries && entries.length > 0 ? entries[0]!.simYear : -10000;
  const maxYear = Math.max(simYear, 1);
  const live = cursor === null;

  const marks = useMemo(() => entries ?? [], [entries]);

  return (
    <div className="border-t border-line bg-panel/90 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-dim whitespace-nowrap">{t("nav.timeline")}</span>
        <span className="text-[10px] text-dim tabular-nums" dir="ltr">{formatNumber(minYear, locale)}</span>
        <div className="relative flex-1 h-8">
          {/* event dots */}
          <div className="absolute inset-x-0 top-0 h-3">
            {marks.map((entry) => {
              const pos = ((entry.simYear - minYear) / Math.max(1, maxYear - minYear)) * 100;
              return (
                <span
                  key={`${entry.tick}-${entry.type}`}
                  title={`${entry.title} (${entry.simYear})`}
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{ insetInlineStart: `${pos}%`, background: eventColorOf(entry.type), opacity: 0.5 + entry.magnitude * 0.5 }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={live ? maxYear : cursor!}
            onChange={(e) => setCursor(Number(e.target.value))}
            className="w-full accent-sky-400 relative top-3"
            dir="ltr"
          />
        </div>
        <span className="text-xs tabular-nums font-bold text-tech whitespace-nowrap" dir="ltr">
          {t("home.year")} {formatNumber(live ? simYear : cursor!, locale)}
        </span>
        {!live && (
          <button onClick={() => setCursor(null)} className="text-[11px] px-2 py-1 rounded bg-tech/15 text-tech whitespace-nowrap">
            {t("home.backToPresent")}
          </button>
        )}
      </div>
      {!live && <div className="text-[10px] text-hazard mt-1">{t("home.historicalMode")}</div>}
    </div>
  );
}
