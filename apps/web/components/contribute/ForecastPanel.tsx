"use client";

import type { ForecastResult } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";

export function ForecastPanel({ forecast }: { forecast: ForecastResult | null }) {
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);

  if (!forecast) return <p className="text-sm text-muted">—</p>;

  const scenarios = [
    { key: "mostLikely", data: forecast.mostLikely, tone: "cyan" as const },
    { key: "best", data: forecast.best, tone: "green" as const },
    { key: "worst", data: forecast.worst, tone: "red" as const },
  ];

  return (
    <div className="space-y-3">
      {forecast.sandbox && <Badge tone="gold">{dict.contribute.sandboxBadge}</Badge>}
      <p className="text-xs text-muted">
        {forecast.years}y · MC {forecast.monteCarloRuns} · uncertainty{" "}
        {(forecast.uncertainty * 100).toFixed(0)}%
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {scenarios.map((s) => (
          <div key={s.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <Badge tone={s.tone}>{s.data.label}</Badge>
            <div className="mt-2 text-lg font-bold text-ink">
              {((s.data.probability || 0) * 100).toFixed(0)}%
            </div>
            <div className="text-[11px] text-muted">
              events: {Array.isArray(s.data.events) ? s.data.events.length : 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
