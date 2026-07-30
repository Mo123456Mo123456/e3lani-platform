"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, type EventRow } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { planetSocket } from "@/lib/ws";
import { useAuthStore } from "@/lib/auth-store";

function importanceTone(sev?: number | null) {
  if (!sev) return "muted" as const;
  if (sev >= 0.7) return "red" as const;
  if (sev >= 0.4) return "orange" as const;
  return "cyan" as const;
}

export function LeftEventLog() {
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["events", planetId],
    queryFn: () => api.getEvents(planetId!, 40),
    enabled: !!planetId,
  });

  useEffect(() => {
    if (!token) return;
    const unsub = planetSocket.on((msg) => {
      if (msg.type === "planet.delta" && msg.planetId === planetId) {
        qc.invalidateQueries({ queryKey: ["events", planetId] });
      }
    });
    return () => {
      unsub();
    };
  }, [token, planetId, qc]);

  const events = (data?.events || []).slice().reverse().slice(0, 12);

  return (
    <Panel
      className="flex h-full max-h-[calc(100vh-11rem)] flex-col"
      title={dict.eventLog.title}
      action={<Badge tone="green" className="animate-pulse-soft">{dict.eventLog.live}</Badge>}
    >
      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto pe-1">
        {isLoading && <p className="text-xs text-muted">{dict.pages.loading}</p>}
        {isError && <p className="text-xs text-red">{dict.pages.offline}</p>}
        {!isLoading && !isError && events.length === 0 && (
          <p className="text-xs text-muted">{dict.eventLog.empty}</p>
        )}
        {events.map((ev: EventRow) => (
          <Link
            key={ev.id}
            href={`/causal/${ev.id}`}
            className="block rounded-lg border border-white/5 bg-white/[0.03] p-2.5 transition hover:border-cyan/30 hover:bg-cyan/5"
          >
            <div className="mb-1 flex items-start gap-2">
              <div className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-cyan/20 bg-gradient-to-br from-slate-800 to-slate-900" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Badge tone={importanceTone(ev.severity)}>{ev.type}</Badge>
                  <span className="text-[10px] text-muted">t{ev.tick}</span>
                </div>
                <div className="mt-1 truncate text-xs font-medium text-ink">{ev.title}</div>
                {ev.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{ev.description}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link href="/timeline" className="mt-3 block">
        <Button variant="secondary" size="sm" className="w-full">
          {dict.eventLog.viewAll}
        </Button>
      </Link>
    </Panel>
  );
}
