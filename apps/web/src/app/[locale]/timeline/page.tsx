"use client";

import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@kawkab/ui";
import { eventColorOf } from "@kawkab/ui";
import type { TimelineEntry } from "@kawkab/shared-types";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";

export default function TimelinePage() {
  const { t, locale } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const { data, isLoading } = useQuery({
    queryKey: ["timeline-full", planetId],
    queryFn: () => api<TimelineEntry[]>(`/api/planets/${planetId}/events/timeline?limit=400`),
    enabled: !!planetId,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">{t("timeline.title")}</h1>
      {isLoading ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : (
        <div className="relative border-s-2 border-line ps-6 space-y-6">
          {(data ?? []).map((entry) => (
            <div key={`${entry.tick}-${entry.type}`} className="relative">
              <span
                className="absolute -start-[31px] top-1 w-3 h-3 rounded-full border-2 border-bg"
                style={{ background: eventColorOf(entry.type) }}
              />
              <div className="text-[11px] text-dim tabular-nums" dir="ltr">
                {entry.simYear < 0 ? `${formatNumber(-entry.simYear, locale)} ←` : formatNumber(entry.simYear, locale)}
              </div>
              <div className="text-sm font-semibold">{entry.title}</div>
              <div className="text-[11px] text-dim">{entry.type}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
