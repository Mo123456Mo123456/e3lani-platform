"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetBootstrap } from "@/lib/use-planet-bootstrap";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

export default function TechnologiesPage() {
  usePlanetBootstrap();
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["techs", planetId],
    queryFn: () => api.getTechnologies(planetId!),
    enabled: !!planetId,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Panel title={dict.pages.technologies}>
        {isLoading && <p className="text-sm text-muted">{dict.pages.loading}</p>}
        {isError && <p className="text-sm text-red">{dict.pages.offline}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.technologies || []).map((tech) => (
            <div key={tech.id} className="rounded-xl border border-purple/25 bg-purple/5 p-4">
              <h3 className="font-bold text-purple">{tech.name}</h3>
              <div className="mt-2 flex gap-1">
                <Badge tone="purple">{tech.category}</Badge>
                <Badge tone="cyan">L{tech.level}</Badge>
              </div>
            </div>
          ))}
        </div>
        {!isLoading && !isError && !(data?.technologies?.length) && (
          <p className="text-sm text-muted">{dict.pages.empty}</p>
        )}
      </Panel>
    </div>
  );
}
