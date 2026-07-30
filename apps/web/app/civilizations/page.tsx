"use client";

import { usePlanetBootstrap } from "@/lib/use-planet-bootstrap";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

export default function CivilizationsPage() {
  usePlanetBootstrap();
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["civs", planetId],
    queryFn: () => api.getCivilizations(planetId!),
    enabled: !!planetId,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Panel title={dict.pages.civilizations}>
        {isLoading && <p className="text-sm text-muted">{dict.pages.loading}</p>}
        {isError && <p className="text-sm text-red">{dict.pages.offline}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.civilizations || []).map((c) => (
            <div key={c.id} className="rounded-xl border border-gold/25 bg-gold/5 p-4">
              <h3 className="font-bold text-gold">{c.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge tone="gold">pop {c.population ?? "—"}</Badge>
                <Badge tone="cyan">tech {(c.techLevel ?? 0).toFixed?.(2) ?? c.techLevel}</Badge>
              </div>
            </div>
          ))}
        </div>
        {!isLoading && !isError && !(data?.civilizations?.length) && (
          <p className="text-sm text-muted">{dict.pages.empty}</p>
        )}
      </Panel>
    </div>
  );
}
