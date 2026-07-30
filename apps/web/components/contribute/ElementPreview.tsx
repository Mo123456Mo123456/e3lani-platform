"use client";

import type { AnalysisResult } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";

export function ElementPreview({
  title,
  description,
  category,
  analysis,
}: {
  title: string;
  description: string;
  category: string;
  analysis?: AnalysisResult | null;
}) {
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);

  return (
    <div className="rounded-xl border border-cyan/25 bg-slate-950/50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="cyan">{dict.categories[category as keyof typeof dict.categories] || category}</Badge>
        {analysis && (
          <Badge tone={analysis.risk > 0.5 ? "red" : "green"}>
            risk {(analysis.risk * 100).toFixed(0)}%
          </Badge>
        )}
      </div>
      <h3 className="text-lg font-bold text-ink">{title || "—"}</h3>
      <p className="mt-1 text-sm text-muted">{description || "—"}</p>
      {analysis?.traits && (
        <pre className="mt-3 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-cyan/80">
          {JSON.stringify(analysis.traits, null, 2)}
        </pre>
      )}
    </div>
  );
}
