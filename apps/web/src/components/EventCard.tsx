"use client";

import type { WorldEvent } from "@planet/shared-types";
import { EventRow } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";

const TYPE_ICONS: Record<string, string> = {
  WAR_STARTED: "⚔",
  WAR_ENDED: "🕊",
  CIVILIZATION_FOUNDED: "🏛",
  CIVILIZATION_COLLAPSED: "🏚",
  CITY_CREATED: "🏙",
  CITY_CAPTURED: "🏰",
  SPECIES_CREATED: "🐾",
  SPECIES_EXTINCT: "💀",
  SPECIES_MUTATED: "🧬",
  SPECIES_MIGRATED: "🦅",
  PLANT_SPREAD: "🌿",
  TECHNOLOGY_DISCOVERED: "⚙",
  DISEASE_OUTBREAK: "☣",
  DISEASE_CONTAINED: "✚",
  VOLCANO_ERUPTED: "🌋",
  CLIMATE_CHANGED: "🌡",
  STORM_FORMED: "🌀",
  DROUGHT_STARTED: "🏜",
  WILDFIRE_STARTED: "🔥",
  FLOOD_OCCURRED: "🌊",
  TRADE_ROUTE_CREATED: "⇄",
  ALLIANCE_CREATED: "🤝",
  ALLIANCE_BROKEN: "✂",
  MIGRATION_STARTED: "👣",
  GOVERNMENT_CHANGED: "👑",
  CULTURE_EVOLVED: "🎭",
  RESOURCE_DISCOVERED: "⛏",
  RESOURCE_DEPLETED: "▪",
  TERRITORY_CHANGED: "▦",
  WORLD_GENESIS: "✦",
  CONTRIBUTION_APPLIED: "★",
};

export function describeEvent(evt: WorldEvent, locale: "ar" | "en"): string {
  const p = evt.payload as Record<string, never>;
  const name = (k: string) => (p[k] as string) ?? "";
  switch (evt.type) {
    case "WORLD_GENESIS":
      return locale === "ar" ? "وُلد الكوكب" : "The planet was born";
    case "CIVILIZATION_FOUNDED":
      return locale === "ar" ? `نشأت حضارة ${name("name")}` : `Civilization founded: ${name("name")}`;
    case "CIVILIZATION_COLLAPSED":
      return locale === "ar" ? `انهارت حضارة ${name("name")}` : `Civilization collapsed: ${name("name")}`;
    case "CITY_CREATED":
      return locale === "ar" ? `أُسست مدينة ${name("name")}` : `City founded: ${name("name")}`;
    case "CITY_CAPTURED":
      return locale === "ar" ? `سقطت مدينة ${name("city")}` : `City captured: ${name("city")}`;
    case "WAR_STARTED": {
      const causes = (p.causes as Array<{ factor: string }>) ?? [];
      return locale === "ar"
        ? `اندلعت حرب: ${name("attacker")} ضد ${name("defender")} (${causes[0]?.factor ?? ""})`
        : `War: ${name("attacker")} vs ${name("defender")} (${causes[0]?.factor ?? ""})`;
    }
    case "WAR_ENDED":
      return locale === "ar"
        ? `انتهت حرب بعد ${p.durationYears} سنة — المنتصر: ${name("winner")}`
        : `War ended after ${p.durationYears}y — winner: ${name("winner")}`;
    case "SPECIES_CREATED":
      return locale === "ar" ? `ظهر مخلوق: ${name("name")}` : `New creature: ${name("name")}`;
    case "SPECIES_EXTINCT":
      return locale === "ar" ? `انقرض: ${name("name")}` : `Extinct: ${name("name")}`;
    case "SPECIES_MUTATED":
      return locale === "ar" ? `طفرة: ${name("child")} من ${name("parent")}` : `Mutation: ${name("child")} from ${name("parent")}`;
    case "PLANT_SPREAD":
      return locale === "ar" ? `انتشر ${name("name")} إلى ${p.totalCells} منطقة` : `${name("name")} spread to ${p.totalCells} regions`;
    case "TECHNOLOGY_DISCOVERED":
      return locale === "ar" ? `اكتُشفت تقنية ${name("tech")}` : `Technology: ${name("tech")}`;
    case "DISEASE_OUTBREAK":
      return locale === "ar" ? `تفشى مرض في ${name("city")}` : `Disease outbreak in ${name("city")}`;
    case "VOLCANO_ERUPTED":
      return locale === "ar" ? "ثار بركان" : "Volcano erupted";
    case "CLIMATE_CHANGED":
      return locale === "ar" ? `تغير مناخي (${name("driver")})` : `Climate shift (${name("driver")})`;
    case "TRADE_ROUTE_CREATED":
      return locale === "ar" ? `طريق تجاري: ${name("from")} ⇄ ${name("to")}` : `Trade route: ${name("from")} ⇄ ${name("to")}`;
    case "ALLIANCE_CREATED":
      return locale === "ar" ? `تحالف جديد` : `New alliance`;
    case "MIGRATION_STARTED":
      return locale === "ar" ? `هجرة ${p.size} فرد (${name("reason")})` : `Migration of ${p.size} (${name("reason")})`;
    case "DROUGHT_STARTED":
      return locale === "ar" ? "جفاف يضرب المناطق" : "Drought spreading";
    case "STORM_FORMED":
      return locale === "ar" ? "تشكلت عاصفة" : "Storm formed";
    case "WILDFIRE_STARTED":
      return locale === "ar" ? "حريق غابات" : "Wildfire";
    case "FLOOD_OCCURRED":
      return locale === "ar" ? "فيضانات" : "Floods";
    case "GOVERNMENT_CHANGED":
      return locale === "ar" ? `تغير الحكم: ${name("from")} ← ${name("to")}` : `Government: ${name("from")} ← ${name("to")}`;
    case "RESOURCE_DEPLETED":
      return locale === "ar" ? `استُنزف مورد ${name("resource")}` : `Resource depleted: ${name("resource")}`;
    default:
      return evt.type;
  }
}

export function EventCard({ evt, onChain }: { evt: WorldEvent; onChain?: (id: string) => void }) {
  const { locale, dict } = useI18n();
  return (
    <EventRow importance={evt.importance} time={`${dict.home.year} ${evt.tick}`}>
      <span style={{ marginInlineEnd: 6 }}>{TYPE_ICONS[evt.type] ?? "•"}</span>
      {describeEvent(evt, locale)}
      {evt.contributionId ? (
        <span className="pb-badge pb-badge--civ" style={{ marginInlineStart: 8 }}>★</span>
      ) : null}
      {onChain ? (
        <button
          className="hud-chip"
          style={{ marginInlineStart: 8, padding: "2px 8px", fontSize: 11 }}
          onClick={() => onChain(evt.id)}
        >
          {dict.events.viewChain}
        </button>
      ) : null}
    </EventRow>
  );
}
