"use client";

/**
 * Bottom timeline — the world's history as era bars built from the real
 * event journal. Scrub to inspect an era's events on the globe and in the
 * feed; play replays history; "back to present" resumes live mode.
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { api, type TimelineResponse } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function TimelineBar() {
  const { t } = useI18n();
  const planetConfig = useAppStore((s) => s.planetConfig);
  const timelineTick = useAppStore((s) => s.timelineTick);
  const setTimelineTick = useAppStore((s) => s.setTimelineTick);
  const appendEvents = useAppStore((s) => s.appendEvents);
  const year = useAppStore((s) => s.year);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!planetConfig) return;
    api.timeline(planetConfig.planetId).then(setTimeline).catch(() => setTimeline(null));
  }, [planetConfig, year > 0 && Math.floor(year / 500)]);

  const maxTick = timeline?.currentTick ?? 0;
  const eras = useMemo(() => timeline?.eras ?? [], [timeline]);

  // era scrub: load the era's events into the feed + globe markers
  const scrubTo = async (tick: number | null) => {
    setTimelineTick(tick);
    if (!planetConfig || tick === null) return;
    const res = await api.events(planetConfig.planetId, `?sinceTick=${tick}&limit=40`);
    appendEvents(res.events.reverse());
  };

  useEffect(() => {
    if (!playing || maxTick === 0) return;
    const interval = setInterval(() => {
      const current = timelineTick ?? 0;
      const next = current + Math.max(1, Math.floor(maxTick / 60));
      if (next >= maxTick) {
        setPlaying(false);
        void scrubTo(null);
      } else {
        void scrubTo(next);
      }
    }, 700);
    return () => clearInterval(interval);
  }, [playing, timelineTick, maxTick, planetConfig]);

  if (!timeline) return null;

  const viewingYear = timelineTick !== null
    ? timelineTick * timeline.yearsPerTick
    : timeline.currentYear;

  return (
    <div className="timeline-bar" id="timeline">
      <div className="timeline-head">
        <h3>{t.timeline.title}</h3>
        <span className="timeline-year">
          {t.common.year} {viewingYear}
          {timelineTick !== null && <em className="viewing-past"> · {t.timeline.viewing}</em>}
        </span>
        <div className="timeline-actions">
          <button onClick={() => setPlaying(!playing)}>{playing ? `⏸ ${t.timeline.pause}` : `▶ ${t.timeline.play}`}</button>
          <button disabled={timelineTick === null} onClick={() => scrubTo(null)}>⟲ {t.timeline.backToPresent}</button>
        </div>
      </div>
      <div className="timeline-track">
        {eras.map((era) => {
          const width = Math.max(2, Math.min(100, (era.count / Math.max(1, ...eras.map((e) => e.count))) * 100));
          const active = timelineTick !== null && timelineTick >= era.tick && timelineTick < era.tick + 20;
          return (
            <button
              key={era.tick}
              className={`era-block ${active ? "active" : ""}`}
              style={{ flexGrow: width }}
              title={`${t.timeline.era} ${era.tick} · ${era.count} ${t.timeline.events}`}
              onClick={() => scrubTo(era.tick)}
            >
              <span className="era-count">{era.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
