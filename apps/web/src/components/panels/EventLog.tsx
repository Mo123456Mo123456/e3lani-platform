"use client";

import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

export interface EventItem {
  id: string;
  type: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  year: number;
  importance: number;
  regionId?: string | null;
  causes: string[];
}

const TYPE_COLOR: Record<string, string> = {
  WAR_STARTED: "var(--pb-red)",
  SPECIES_CREATED: "var(--pb-cyan)",
  PLANT_CREATED: "var(--pb-green)",
  PLANT_SPREAD: "var(--pb-green)",
  CIVILIZATION_FOUNDED: "var(--pb-gold)",
  TECHNOLOGY_DISCOVERED: "var(--pb-cyan)",
  MIGRATION_STARTED: "var(--pb-purple)",
  VOLCANO_ERUPTED: "var(--pb-orange)",
  DISEASE_OUTBREAK: "var(--pb-red)",
  RESOURCE_DISCOVERED: "var(--pb-cyan)",
  CONTRIBUTION_APPLIED: "var(--pb-white)",
};

export function EventLog({
  events,
  onFocus,
}: {
  events: EventItem[];
  onFocus?: (regionId?: string | null) => void;
}) {
  const locale = useAppStore((s) => s.locale);

  return (
    <aside className="panel event-log pb-panel">
      <h2>{t(locale, "eventLog")}</h2>
      <div className="event-list">
        {events.map((e) => (
          <button
            key={e.id}
            className="event-card"
            onClick={() => onFocus?.(e.regionId)}
            style={{ borderColor: TYPE_COLOR[e.type] ?? "var(--pb-border)" }}
          >
            <div
              className="event-thumb"
              style={{ background: TYPE_COLOR[e.type] ?? "var(--pb-gray)" }}
            />
            <div className="event-body">
              <div className="event-title">{locale === "ar" ? e.titleAr : e.title}</div>
              <div className="event-desc">
                {locale === "ar" ? e.descriptionAr : e.description}
              </div>
              <div className="event-meta">
                <span>{Math.round(e.year)} Y</span>
                <span>{Math.round(e.importance * 100)}%</span>
                {e.causes?.[0] && <span>{e.causes[0]}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="panel-footer">{t(locale, "viewAllEvents")}</div>
    </aside>
  );
}
