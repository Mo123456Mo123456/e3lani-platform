"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetBootstrap } from "@/lib/use-planet-bootstrap";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

export default function CreaturesPage() {
  usePlanetBootstrap();
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["species", planetId],
    queryFn: () => api.getSpecies(planetId!),
    enabled: !!planetId,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Panel title={dict.pages.creatures}>
        {isLoading && <p className="text-sm text-muted">{dict.pages.loading}</p>}
        {isError && <p className="text-sm text-red">{dict.pages.offline}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.species || []).map((s) => (
            <div key={s.id} className="rounded-xl border border-cyan/25 bg-cyan/5 p-4">
              <h3 className="font-bold text-cyan">{s.name}</h3>
              <Badge tone="green" className="mt-2">
                pop {s.population ?? "—"}
              </Badge>
            </div>
          ))}
        </div>
        {!isLoading && !isError && !(data?.species?.length) && (
          <p className="text-sm text-muted">{dict.pages.empty}</p>
        )}
      </Panel>
    </div>
  );
}
