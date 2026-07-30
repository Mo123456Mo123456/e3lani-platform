/**
 * Constrained narrator — turns simulation results into prose.
 *
 * Hard rule enforced here: the narrator may ONLY mention events that exist
 * in the causal allowlist derived from the journal. There is no path by
 * which the narration layer can invent history, because every sentence is
 * built from (and tagged with) a real event record.
 */
import type { Locale, WorldEvent } from "@planet/shared-types";
import { narrationAllowlist } from "@planet/simulation-models";

export interface NarrationResult {
  text: string;
  eventIds: string[];
  provider: "mock" | "remote";
}

const AR_TEMPLATES: Partial<Record<WorldEvent["type"], (e: WorldEvent) => string>> = {
  PLANT_SPREAD: (e) => `انتشر «${actor(e)}» في مناطق جديدة (${String(e.data.biome ?? "")})`,
  SPECIES_CREATED: (e) => `ظهر «${actor(e)}» لأول مرة`,
  SPECIES_MIGRATED: (e) => `هاجر «${actor(e)}» بحثًا عن موطن أفضل`,
  SPECIES_EXTINCT: (e) => `انقرض «${actor(e)}» — ${e.cause}`,
  SPECIES_MUTATED: (e) => `انقسم «${actor(e)}» إلى نوع فرعي جديد عبر الطفرات`,
  RESOURCE_DISCOVERED: (e) => `دخل مورد «${String(e.data.resource ?? "")}» دورة الاقتصاد`,
  RESOURCE_DEPLETED: (e) => `نضب مورد «${String(e.data.resource ?? "")}» — ${e.cause}`,
  TECHNOLOGY_DISCOVERED: (e) => `اعتُمد اختراع «${String(e.data.technology ?? "")}»`,
  WAR_STARTED: (e) => `اندلعت حرب — ${e.cause}`,
  WAR_ENDED: (e) => `انتهت حرب (${String(e.data.casualties ?? 0)} ضحية) — ${e.cause}`,
  CIVILIZATION_FOUNDED: (e) => `قامت حضارة «${actor(e)}»`,
  CIVILIZATION_COLLAPSED: (e) => `انهارت حضارة «${actor(e)}» — ${e.cause}`,
  CITY_CREATED: (e) => `تأسست مدينة «${String(e.data.city ?? "")}»`,
  DISEASE_OUTBREAK: (e) => `تفشى وباء «${String(e.data.disease ?? "")}»`,
  CLIMATE_CHANGED: (e) => `تغير المناخ — ${e.cause}`,
  DROUGHT_STARTED: () => `ضرب الجفاف الأرض`,
  VOLCANO_ERUPTED: () => `ثار بركان وأظلّلت السماء`,
  TRADE_ROUTE_CREATED: (e) => `انفتح طريق تجاري — ${e.cause}`,
  ALLIANCE_CREATED: (e) => `تشكل تحالف — ${e.cause}`,
};

const EN_TEMPLATES: Partial<Record<WorldEvent["type"], (e: WorldEvent) => string>> = {
  PLANT_SPREAD: (e) => `"${actor(e)}" spread into new lands (${String(e.data.biome ?? "")})`,
  SPECIES_CREATED: (e) => `"${actor(e)}" appeared for the first time`,
  SPECIES_MIGRATED: (e) => `"${actor(e)}" migrated seeking a better habitat`,
  SPECIES_EXTINCT: (e) => `"${actor(e)}" went extinct — ${e.cause}`,
  SPECIES_MUTATED: (e) => `"${actor(e)}" split into a new subspecies`,
  RESOURCE_DISCOVERED: (e) => `the resource "${String(e.data.resource ?? "")}" entered the economy`,
  RESOURCE_DEPLETED: (e) => `the resource "${String(e.data.resource ?? "")}" ran dry — ${e.cause}`,
  TECHNOLOGY_DISCOVERED: (e) => `the invention "${String(e.data.technology ?? "")}" was adopted`,
  WAR_STARTED: (e) => `a war broke out — ${e.cause}`,
  WAR_ENDED: (e) => `a war ended (${String(e.data.casualties ?? 0)} casualties) — ${e.cause}`,
  CIVILIZATION_FOUNDED: (e) => `the civilization "${actor(e)}" arose`,
  CIVILIZATION_COLLAPSED: (e) => `the civilization "${actor(e)}" collapsed — ${e.cause}`,
  CITY_CREATED: (e) => `the city "${String(e.data.city ?? "")}" was founded`,
  DISEASE_OUTBREAK: (e) => `the disease "${String(e.data.disease ?? "")}" broke out`,
  CLIMATE_CHANGED: (e) => `the climate shifted — ${e.cause}`,
  DROUGHT_STARTED: () => `drought struck the land`,
  VOLCANO_ERUPTED: () => `a volcano erupted, dimming the skies`,
  TRADE_ROUTE_CREATED: (e) => `a trade route opened — ${e.cause}`,
  ALLIANCE_CREATED: (e) => `an alliance formed — ${e.cause}`,
};

function actor(event: WorldEvent): string {
  return event.actors[0]?.name ?? "—";
}

export function narrateContribution(
  journal: WorldEvent[],
  contributionId: string,
  contributionName: string,
  locale: Locale,
): NarrationResult {
  const { eventIds } = narrationAllowlist(journal, contributionId);
  const templates = locale === "ar" ? AR_TEMPLATES : EN_TEMPLATES;
  const allowed = journal.filter((e) => eventIds.has(e.id));

  const sentences: string[] = [];
  const usedIds: string[] = [];
  for (const event of allowed.sort((a, b) => a.tick - b.tick)) {
    const template = templates[event.type];
    if (!template) continue;
    sentences.push(`${template(event)} (السنة ${event.year}).`);
    usedIds.push(event.id);
  }

  if (sentences.length === 0) {
    const empty =
      locale === "ar"
        ? `أُضيف «${contributionName}» إلى العالم، ولم تتراكم آثاره بعد. شغّل المحاكاة لترى ما سيحدث.`
        : `"${contributionName}" entered the world; its effects have not accumulated yet. Run the simulation to see what happens.`;
    return { text: empty, eventIds: [], provider: "mock" };
  }

  const intro =
    locale === "ar"
      ? `قصة «${contributionName}» حتى الآن: `
      : `The story of "${contributionName}" so far: `;
  return { text: intro + sentences.join(" "), eventIds: usedIds, provider: "mock" };
}
