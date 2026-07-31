"use client";

import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";

export function BottomTimeline({
  planetId,
  currentTick,
  eraFilter,
  onSelectEra,
}: {
  planetId: string | null;
  currentTick: number;
  eraFilter: { from: number; to: number } | null;
  onSelectEra: (era: { from: number; to: number } | null) => void;
}) {
  const { dict } = useI18n();
  const { data } = useQuery({
    queryKey: ["timeline", planetId],
    queryFn: () => api().getTimeline(planetId!),
    enabled: Boolean(planetId),
    staleTime: 60_000,
  });

  const eras = data?.eras ?? [];
  const maxCount = Math.max(1, ...eras.map((e) => e.eventCount));

  return (
    <footer className="timeline-bar app-timeline">
      <div className="timeline-year">
        {dict.home.year} <strong>{currentTick}</strong>
      </div>
      <div
        className="timeline-track"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={currentTick}
        aria-valuenow={eraFilter?.from ?? currentTick}
        tabIndex={0}
      >
        {eras.map((era) => {
          const active = eraFilter?.from === era.fromTick;
          return (
            <div
              key={era.fromTick}
              className={`timeline-bucket ${active ? "timeline-bucket--active" : ""}`}
              style={{ height: `${12 + (era.eventCount / maxCount) * 88}%` }}
              title={`${dict.home.year} ${era.fromTick}–${era.toTick} · ${era.eventCount}`}
              onClick={() => onSelectEra(active ? null : { from: era.fromTick, to: era.toTick })}
            />
          );
        })}
      </div>
      {eraFilter ? (
        <button className="hud-chip" onClick={() => onSelectEra(null)}>
          {dict.home.year} {eraFilter.from}–{eraFilter.to} ✕
        </button>
      ) : null}
    </footer>
  );
}
