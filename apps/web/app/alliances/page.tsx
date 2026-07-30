"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetBootstrap } from "@/lib/use-planet-bootstrap";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

export default function AlliancesPage() {
  usePlanetBootstrap();
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["alliances", planetId],
    queryFn: () => api.getAlliances(planetId!),
    enabled: !!planetId,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Panel title={dict.pages.alliances}>
        {isLoading && <p className="text-sm text-muted">{dict.pages.loading}</p>}
        {isError && <p className="text-sm text-red">{dict.pages.offline}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.alliances || []).map((a) => (
            <div key={a.id} className="rounded-xl border border-green/25 bg-green/5 p-4">
              <h3 className="font-bold text-green">{a.name}</h3>
              <div className="mt-2 flex gap-1">
                <Badge tone="green">{a.status}</Badge>
                <Badge tone="cyan">{(a.strength * 100).toFixed(0)}%</Badge>
              </div>
            </div>
          ))}
        </div>
        {!isLoading && !isError && !(data?.alliances?.length) && (
          <p className="text-sm text-muted">{dict.pages.empty}</p>
        )}
      </Panel>
    </div>
  );
}
