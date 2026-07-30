/**
 * Derives user notifications from world events. Only events carrying an
 * originUserId (i.e. traceable to a user's contribution) produce
 * notifications — the message names the actual event that happened.
 */
import { randomUUID } from "node:crypto";
import type { Notification, WorldEvent } from "@planet/shared-types";

const TEMPLATES: Partial<Record<WorldEvent["type"], { kind: string; ar: string; en: string }>> = {
  SPECIES_CREATED: {
    kind: "contribution_species",
    ar: "ظهر المخلوق الذي أضفته إلى العالم",
    en: "Your contributed creature has appeared in the world",
  },
  SPECIES_MUTATED: {
    kind: "contribution_evolution",
    ar: "تفرّع نوعٌ جديد من مخلوقك عبر الطفرات",
    en: "A new subspecies branched off your creature",
  },
  SPECIES_MIGRATED: {
    kind: "contribution_spread",
    ar: "هاجر مخلوقك إلى موطن جديد",
    en: "Your creature migrated to a new habitat",
  },
  SPECIES_EXTINCT: {
    kind: "contribution_extinct",
    ar: "انقرض المخلوق الذي أنشأته",
    en: "The creature you created has gone extinct",
  },
  PLANT_SPREAD: {
    kind: "contribution_plant",
    ar: "انتشر نباتك في مناطق جديدة من الكوكب",
    en: "Your plant spread to new regions of the planet",
  },
  RESOURCE_DISCOVERED: {
    kind: "contribution_resource",
    ar: "تم توظيف موردك داخل اقتصاد العالم",
    en: "Your resource entered the world economy",
  },
  TECHNOLOGY_DISCOVERED: {
    kind: "contribution_tech",
    ar: "اعتمدت إحدى الحضارات اختراعك",
    en: "A civilization adopted your invention",
  },
  TRADE_ROUTE_CREATED: {
    kind: "contribution_trade",
    ar: "نشأ طريق تجاري متصل بأثر إضافتك",
    en: "A trade route connected to your contribution emerged",
  },
  WAR_STARTED: {
    kind: "contribution_war",
    ar: "اندلعت حرب مرتبطة بسلسلة أحداث بدأها عنصرك",
    en: "A war linked to your contribution's causal chain broke out",
  },
  CIVILIZATION_FOUNDED: {
    kind: "contribution_civ",
    ar: "أسست إضافتك حضارة جديدة",
    en: "Your contribution founded a new civilization",
  },
  DISEASE_OUTBREAK: {
    kind: "contribution_disease",
    ar: "تفشى الوباء المرتبط بإضافتك",
    en: "The pathogen tied to your contribution broke out",
  },
  CLIMATE_CHANGED: {
    kind: "contribution_climate",
    ar: "غيّرت إضافتك مناخ الكوكب",
    en: "Your contribution shifted the planet's climate",
  },
};

export function notificationForEvent(event: WorldEvent): Notification | null {
  if (!event.originUserId) return null;
  const template = TEMPLATES[event.type];
  if (!template) return null;
  return {
    id: randomUUID(),
    userId: event.originUserId,
    kind: template.kind,
    title: template.ar,
    body: `${template.en} — year ${event.year}, ${event.cause}`,
    eventId: event.id,
    read: false,
    createdAt: new Date().toISOString(),
  };
}
