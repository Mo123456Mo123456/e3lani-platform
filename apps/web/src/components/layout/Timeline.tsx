"use client";

import type { Dictionary } from "@/lib/i18n";
import { useWorldStore } from "@/lib/store";

const milestones = [
  { year: "00:00", icon: "✦", color: "cyan" },
  { year: "01:40", icon: "⌁", color: "green" },
  { year: "03:15", icon: "⌂", color: "gold" },
  { year: "05:50", icon: "↝", color: "purple" },
  { year: "08:20", icon: "◇", color: "cyan" },
];

export function Timeline({ dictionary }: { dictionary: Dictionary }) {
  const playing = useWorldStore((state) => state.timelinePlaying);
  const toggle = useWorldStore((state) => state.toggleTimeline);

  return (
    <section className="glass-panel timeline">
      <button className={`play-button ${playing ? "playing" : ""}`} onClick={toggle} aria-label={playing ? dictionary.pause : dictionary.play}>
        {playing ? "Ⅱ" : "▶"}
      </button>
      <div className="timeline-track">
        <div className={`timeline-progress ${playing ? "animate" : ""}`} />
        {milestones.map((milestone, index) => (
          <button
            className={`milestone color-${milestone.color}`}
            style={{ insetInlineStart: `${index * 24.5}%` }}
            key={milestone.year}
            title={milestone.year}
          >
            <span>{milestone.icon}</span>
            <small>{index === milestones.length - 1 ? dictionary.now : milestone.year}</small>
          </button>
        ))}
      </div>
      <div className="timeline-date">
        <small>{dictionary.nav.timeline}</small>
        <strong>08:20:14</strong>
      </div>
    </section>
  );
}
