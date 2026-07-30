"use client";

/**
 * Left panel — the live event log. Every card is a real journal entry:
 * type icon, description, year, location, importance, causal chain.
 */
import { useI18n } from "@/i18n/I18nProvider";
import { useAppStore } from "@/lib/store";
import type { WorldEvent } from "@planet/shared-types";

const EVENT_ICONS: Partial<Record<WorldEvent["type"], string>> = {
  WORLD_GENESIS: "🌌",
  SPECIES_CREATED: "🐾",
  SPECIES_MUTATED: "🧬",
  SPECIES_MIGRATED: "🐘",
  SPECIES_EXTINCT: "💀",
  PLANT_SPREAD: "🌿",
  CIVILIZATION_FOUNDED: "🏛️",
  CIVILIZATION_COLLAPSED: "🏚️",
  CITY_CREATED: "🏙️",
  CITY_DESTROYED: "🔥",
  TECHNOLOGY_DISCOVERED: "⚙️",
  WAR_STARTED: "⚔️",
  WAR_ENDED: "🕊️",
  MIGRATION_STARTED: "🚶",
  ALLIANCE_CREATED: "🤝",
  DISEASE_OUTBREAK: "☠️",
  DISEASE_CONTAINED: "💊",
  CLIMATE_CHANGED: "🌡️",
  DROUGHT_STARTED: "🏜️",
  WILDFIRE_STARTED: "🔥",
  FLOOD_OCCURRED: "🌊",
  VOLCANO_ERUPTED: "🌋",
  RESOURCE_DISCOVERED: "⛏️",
  RESOURCE_DEPLETED: "🕳️",
  TRADE_ROUTE_CREATED: "🛤️",
  CONTRIBUTION_PLACED: "✨",
  GOVERNMENT_CHANGED: "📜",
};

function describe(event: WorldEvent, locale: "ar" | "en"): string {
  const actor = event.actors[0]?.name ?? "";
  const templates: Partial<Record<WorldEvent["type"], [string, string]>> = {
    WORLD_GENESIS: ["ولادة الكوكب", "Planet genesis"],
    SPECIES_CREATED: [`ظهر نوع «${actor}»`, `"${actor}" emerged`],
    SPECIES_MUTATED: [`طفرة جديدة من «${actor}»`, `"${actor}" mutated`],
    SPECIES_MIGRATED: [`هجرة «${actor}»`, `"${actor}" migrated`],
    SPECIES_EXTINCT: [`انقراض «${actor}»`, `"${actor}" extinct`],
    PLANT_SPREAD: [`انتشار «${actor}»`, `"${actor}" spread`],
    CIVILIZATION_FOUNDED: [`قيام حضارة «${actor}»`, `"${actor}" founded`],
    CIVILIZATION_COLLAPSED: [`انهيار حضارة «${actor}»`, `"${actor}" collapsed`],
    CITY_CREATED: [`تأسيس مدينة «${String(event.data.city ?? actor)}»`, `city "${String(event.data.city ?? actor)}" founded`],
    CITY_DESTROYED: [`سقوط مدينة «${String(event.data.city ?? "")}»`, `city "${String(event.data.city ?? "")}" destroyed`],
    TECHNOLOGY_DISCOVERED: [`اكتشاف «${String(event.data.technology ?? "")}»`, `"${String(event.data.technology ?? "")}" discovered`],
    WAR_STARTED: [`اندلاع حرب — ${actor}`, `war broke out — ${actor}`],
    WAR_ENDED: [`نهاية حرب (${String(event.data.casualties ?? 0)} ضحية)`, `war ended (${String(event.data.casualties ?? 0)} casualties)`],
    MIGRATION_STARTED: [`هجرة جماعية — ${actor}`, `mass migration — ${actor}`],
    ALLIANCE_CREATED: [`تحالف جديد`, `new alliance`],
    DISEASE_OUTBREAK: [`تفشي «${String(event.data.disease ?? "")}»`, `"${String(event.data.disease ?? "")}" outbreak`],
    DISEASE_CONTAINED: [`احتواء وباء`, `disease contained`],
    CLIMATE_CHANGED: [`تغير مناخي`, `climate shift`],
    DROUGHT_STARTED: [`جفاف`, `drought`],
    WILDFIRE_STARTED: [`حريق غابات`, `wildfire`],
    FLOOD_OCCURRED: [`فيضان`, `flood`],
    VOLCANO_ERUPTED: [`ثوران بركان`, `volcanic eruption`],
    RESOURCE_DISCOVERED: [`اكتشاف ${String(event.data.resource ?? "")}`, `${String(event.data.resource ?? "")} discovered`],
    RESOURCE_DEPLETED: [`نضوب ${String(event.data.resource ?? "")}`, `${String(event.data.resource ?? "")} depleted`],
    TRADE_ROUTE_CREATED: [`طريق تجاري جديد`, `new trade route`],
    CONTRIBUTION_PLACED: [`إضافة «${actor}» إلى العالم`, `"${actor}" entered the world`],
    GOVERNMENT_CHANGED: [`تحول سياسي`, `governance shift`],
  };
  const pair = templates[event.type];
  if (!pair) return event.type;
  return locale === "ar" ? pair[0] : pair[1];
}

export function EventFeed() {
  const { t, locale } = useI18n();
  const events = useAppStore((s) => s.events);
  const setSelectedCell = useAppStore((s) => s.setSelectedCell);

  return (
    <aside className="panel event-feed">
      <h2 className="panel-title">{t.feed.title}</h2>
      <div className="feed-list">
        {events.length === 0 && <p className="feed-empty">{t.feed.empty}</p>}
        {events.map((event) => (
          <button
            key={event.id}
            className={`feed-card importance-${event.importance >= 0.7 ? "high" : event.importance >= 0.45 ? "mid" : "low"}`}
            onClick={() => event.cell >= 0 && setSelectedCell(event.cell)}
          >
            <span className="feed-icon">{EVENT_ICONS[event.type] ?? "•"}</span>
            <span className="feed-body">
              <span className="feed-title">{describe(event, locale)}</span>
              <span className="feed-cause">{event.cause}</span>
              <span className="feed-meta">
                {t.feed.year} {event.year}
                {event.originUserId && " · ✦"}
              </span>
            </span>
            <span className="feed-importance" style={{ ["--imp" as string]: event.importance }} />
          </button>
        ))}
      </div>
    </aside>
  );
}
