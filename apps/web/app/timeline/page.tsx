"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetBootstrap } from "@/lib/use-planet-bootstrap";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { BottomTimeline } from "@/components/layout/BottomTimeline";

export default function TimelinePage() {
  usePlanetBootstrap();
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);

  const { data: timeline, isLoading } = useQuery({
    queryKey: ["timeline", planetId],
    queryFn: () => api.getTimeline(planetId!),
    enabled: !!planetId,
  });

  const { data: events } = useQuery({
    queryKey: ["events", planetId, "all"],
    queryFn: () => api.getEvents(planetId!, 200),
    enabled: !!planetId,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <Panel title={dict.pages.timelinePage}>
        <BottomTimeline />
      </Panel>
      <Panel title={dict.eventLog.title}>
        {isLoading && <p className="text-sm text-muted">{dict.pages.loading}</p>}
        <div className="mb-4 flex flex-wrap gap-2">
          {(timeline?.snapshots || []).map((s) => (
            <Badge key={s.id} tone="cyan">
              {s.label} · t{s.tick}
            </Badge>
          ))}
        </div>
        <div className="space-y-2">
          {(events?.events || [])
            .slice()
            .reverse()
            .map((ev) => (
              <Link
                key={ev.id}
                href={`/causal/${ev.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan/30"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone="orange">{ev.type}</Badge>
                    <span className="text-[10px] text-muted">t{ev.tick}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-ink">{ev.title}</div>
                  {ev.description && <p className="mt-0.5 text-xs text-muted">{ev.description}</p>}
                </div>
              </Link>
            ))}
          {!events?.events?.length && !isLoading && (
            <p className="text-sm text-muted">{dict.pages.empty}</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
