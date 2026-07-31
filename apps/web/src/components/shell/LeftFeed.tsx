"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Panel, Spinner, Empty } from "@planet/ui";
import type { WorldEvent } from "@planet/shared-types";
import { EVENT_CATEGORY } from "@planet/shared-types";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { EventCard } from "../EventCard";

const FILTERS = ["all", "civilizations", "conflicts", "life", "climate", "economy", "migrations", "technology", "contributions"] as const;

export function LeftFeed({
  planetId,
  liveEvents,
  onChain,
  eraFilter,
}: {
  planetId: string | null;
  liveEvents: WorldEvent[];
  onChain: (eventId: string) => void;
  eraFilter: { from: number; to: number } | null;
}) {
  const { dict } = useI18n();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [minImportance, setMinImportance] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["events", planetId, eraFilter],
    queryFn: () =>
      api().getEvents(planetId!, {
        pageSize: 40,
        minImportance: 2,
        fromTick: eraFilter?.from,
        toTick: eraFilter?.to,
      }),
    enabled: Boolean(planetId),
    refetchInterval: 30_000,
  });

  const merged: WorldEvent[] = [];
  const seen = new Set<string>();
  for (const evt of [...liveEvents, ...(data?.items ?? [])]) {
    if (seen.has(evt.id)) continue;
    seen.add(evt.id);
    if (filter !== "all" && EVENT_CATEGORY[evt.type] !== filter) continue;
    if (evt.importance < minImportance) continue;
    if (eraFilter && (evt.tick < eraFilter.from || evt.tick > eraFilter.to)) continue;
    merged.push(evt);
  }
  merged.sort((a, b) => b.tick - a.tick);

  return (
    <aside className="app-left pb-scroll">
      <div className="side-panel">
        <Panel
          title={dict.home.liveEvents}
          actions={
            <Badge tone="tech">{merged.length}</Badge>
          }
        >
          <div className="pb-chip-row" style={{ marginBottom: 10 }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`hud-chip ${filter === f ? "hud-chip--active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? dict.events.all : f}
              </button>
            ))}
          </div>
          <div className="pb-chip-row" style={{ marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                className={`hud-chip ${minImportance === i ? "hud-chip--active" : ""}`}
                onClick={() => setMinImportance(i)}
                title={dict.events.importance}
              >
                {i >= 4 ? "★".repeat(i - 2) : `${i}+`}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><Spinner /></div>
          ) : merged.length === 0 ? (
            <Empty>—</Empty>
          ) : (
            merged.slice(0, 50).map((evt) => <EventCard key={evt.id} evt={evt} onChain={onChain} />)
          )}
        </Panel>
      </div>
    </aside>
  );
}
