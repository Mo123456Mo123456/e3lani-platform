"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Spinner } from "@kawkab/ui";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { useT } from "@/components/LocaleProvider";
import { TECH_ERAS } from "@kawkab/shared-types";

interface TechRow {
  key: string;
  name: string;
  era: string;
  prereqKeys: string[];
  discoveredBy: string[];
}

export default function TechnologiesPage() {
  const { t } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const { data, isLoading } = useQuery({
    queryKey: ["techs", planetId],
    queryFn: () => api<TechRow[]>(`/api/worlds/${planetId}/technologies`),
    enabled: !!planetId,
    refetchInterval: 60_000,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">{t("nav.technologies")}</h1>
      {isLoading ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          {TECH_ERAS.map((era) => {
            const techs = (data ?? []).filter((x) => x.era === era);
            if (techs.length === 0) return null;
            return (
              <div key={era}>
                <h2 className="text-sm font-semibold text-tech mb-2" dir="ltr">{era}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {techs.map((tech) => (
                    <div key={tech.key} className="rounded-lg border border-line bg-panel p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium flex-1" dir="ltr">{tech.name}</span>
                        {tech.discoveredBy.length > 0 ? (
                          <Badge color="#34d399">{tech.discoveredBy.length}</Badge>
                        ) : (
                          <Badge color="#8b98a9">—</Badge>
                        )}
                      </div>
                      {tech.prereqKeys.length > 0 && (
                        <div className="text-[10px] text-dim mt-1" dir="ltr">requires: {tech.prereqKeys.join(", ")}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
