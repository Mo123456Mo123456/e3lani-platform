"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetBootstrap } from "@/lib/use-planet-bootstrap";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

export default function ResourcesPage() {
  usePlanetBootstrap();
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["resources", planetId],
    queryFn: () => api.getResources(planetId!),
    enabled: !!planetId,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Panel title={dict.pages.resources}>
        {isLoading && <p className="text-sm text-muted">{dict.pages.loading}</p>}
        {isError && <p className="text-sm text-red">{dict.pages.offline}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.resources || []).map((r) => (
            <div key={r.id} className="rounded-xl border border-orange/25 bg-orange/5 p-4">
              <h3 className="font-bold text-orange">{r.name}</h3>
              <div className="mt-2 flex gap-1">
                <Badge tone="orange">{r.type}</Badge>
                <Badge tone="muted">{(r.abundance * 100).toFixed(0)}%</Badge>
              </div>
            </div>
          ))}
        </div>
        {!isLoading && !isError && !(data?.resources?.length) && (
          <p className="text-sm text-muted">{dict.pages.empty}</p>
        )}
      </Panel>
    </div>
  );
}
