"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Spinner } from "@kawkab/ui";
import { eventColorOf } from "@kawkab/ui";
import type { Page, WorldEvent } from "@kawkab/shared-types";
import { WORLD_EVENT_TYPES } from "@kawkab/shared-types";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";

export default function ExplorePage() {
  const { t, locale } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const selectRegion = useWorldStore((s) => s.selectRegion);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["events", planetId, typeFilter, page],
    queryFn: () =>
      api<Page<WorldEvent & { regionIndex: number | null }>>(
        `/api/planets/${planetId}/events?page=${page}&pageSize=30${typeFilter ? `&types=${typeFilter}` : ""}`,
      ),
    enabled: !!planetId,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">{t("explore.title")}</h1>
      <div className="flex flex-wrap gap-1 mb-4">
        <button onClick={() => { setTypeFilter(""); setPage(1); }} className={`text-[11px] px-2 py-1 rounded border ${typeFilter === "" ? "border-tech text-tech" : "border-line text-dim"}`}>
          {t("common.all")}
        </button>
        {WORLD_EVENT_TYPES.filter((x) => !["PLANET_FORMED", "OCEANS_FORMED"].includes(x)).map((type) => (
          <button
            key={type}
            onClick={() => { setTypeFilter(type); setPage(1); }}
            className={`text-[11px] px-2 py-1 rounded border ${typeFilter === type ? "border-tech text-tech" : "border-line text-dim"}`}
          >
            {type}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {(data?.items ?? []).map((ev) => (
            <button
              key={ev.id}
              onClick={() => {
                if (ev.regionIndex !== null && ev.regionIndex !== undefined) selectRegion(ev.regionIndex, null);
              }}
              className="w-full text-start rounded-lg border border-line bg-panel hover:bg-panelAlt p-3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: eventColorOf(ev.type) }} />
                <span className="text-sm font-semibold flex-1">{ev.title}</span>
                <Badge color="#38bdf8">{ev.type}</Badge>
                <span className="text-[11px] text-dim tabular-nums" dir="ltr">{t("home.year")} {formatNumber(ev.simYear, locale)}</span>
              </div>
              <div className="text-xs text-dim mt-1">{ev.summary}</div>
            </button>
          ))}
          <div className="flex justify-center gap-2 pt-3">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-xs px-3 py-1 rounded border border-line text-dim disabled:opacity-40">‹</button>
            <span className="text-xs text-dim tabular-nums py-1">{formatNumber(data?.total ?? 0, locale)}</span>
            <button disabled={(data?.items.length ?? 0) < 30} onClick={() => setPage((p) => p + 1)} className="text-xs px-3 py-1 rounded border border-line text-dim disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
