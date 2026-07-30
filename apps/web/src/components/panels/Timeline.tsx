"use client";

import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

export interface Milestone {
  id: string;
  year: number;
  title: string;
  titleAr: string;
  type: string;
  importance: number;
  contributionId?: string | null;
}

export function Timeline({
  milestones,
  currentYear,
  onPlay,
  playing,
}: {
  milestones: Milestone[];
  currentYear: number;
  onPlay: () => void;
  playing: boolean;
}) {
  const locale = useAppStore((s) => s.locale);
  const sorted = [...milestones].sort((a, b) => a.year - b.year);

  return (
    <footer className="timeline pb-panel">
      <div className="timeline-controls">
        <button className="pb-btn" onClick={onPlay}>
          {playing ? "❚❚" : "▶"}
        </button>
        <span>{t(locale, "advanceTime")}</span>
      </div>
      <div className="timeline-track">
        {sorted.map((m) => {
          const isLive = Math.abs(m.year - currentYear) < 2;
          return (
            <div key={m.id} className={isLive ? "tl-card live" : "tl-card"}>
              {isLive && <span className="live-badge">{t(locale, "live")}</span>}
              <div className="tl-title">{locale === "ar" ? m.titleAr : m.title}</div>
              <div className="tl-year">
                {m.year > 0 ? m.year : Math.abs(m.year)}{" "}
                {m.year > 0 ? "" : locale === "ar" ? "قبل" : "ago"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="timeline-footer">{t(locale, "worldEvolves")}</div>
    </footer>
  );
}
