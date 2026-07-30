import { ContributionCategory, type AnalyzedContribution } from "@planet/shared-types";
import type { AnalyzeRequest, LLMProvider, NarrateRequest, NarrateResult } from "./base.js";

/**
 * Deterministic local analyzer used in Sandbox (no external keys).
 * Keyword-driven trait extraction in Arabic and English; results are always
 * flagged `sandbox: true` so they are never presented as real AI in production.
 */

const KEYWORD_MAP: { pattern: RegExp; apply: (t: Record<string, number>) => void }[] = [
  { pattern: /عملاق|ضخم|giant|huge|titan/i, apply: (t) => (t["size"] = 0.9) },
  { pattern: /صغير|tiny|small/i, apply: (t) => (t["size"] = 0.15) },
  { pattern: /سريع النمو|fast.?grow|rapid/i, apply: (t) => (t["growthRate"] = 0.85) },
  { pattern: /بطيء|slow/i, apply: (t) => (t["growthRate"] = 0.2) },
  { pattern: /[يت]متص التلوث|يمتص|تنقية|absorb.?pollution|clean.?air|purif/i, apply: (t) => (t["pollutionAbsorption"] = 0.9) },
  { pattern: /تلوث|pollut|smog|toxic waste/i, apply: (t) => (t["pollutionEmission"] = 0.7) },
  { pattern: /[يت]ضيء|مضيء|توهج|glow|lumin|light/i, apply: (t) => (t["nightLuminosity"] = 0.85) },
  { pattern: /ماء|water|river|نهر/i, apply: (t) => (t["waterNeed"] = 0.8) },
  { pattern: /صحراء|desert|جفاف|drought/i, apply: (t) => { t["waterNeed"] = 0.15; t["heatResistance"] = 0.9; } },
  { pattern: /جليد|ice|frozen|قطب|arctic/i, apply: (t) => (t["coldResistance"] = 0.9) },
  { pattern: /نار|fire|بركان|volcan|lava/i, apply: (t) => (t["heatResistance"] = 0.9) },
  { pattern: /شرس|عدواني|مفترس|predator|aggress|fierce/i, apply: (t) => (t["aggression"] = 0.85) },
  { pattern: /ذكي|intelligent|smart|عاقل/i, apply: (t) => (t["intelligence"] = 0.8) },
  { pattern: /يتكاثر|reproduc|تكاثر|breed/i, apply: (t) => (t["reproductionRate"] = 0.85) },
  { pattern: /طاقة|energy|كهربا|solar|شمس/i, apply: (t) => (t["energyOutput"] = 0.8) },
  { pattern: /نادر|rare|فريد/i, apply: (t) => (t["rarity"] = 0.85) },
  { pattern: /سام|poison|toxic|venom/i, apply: (t) => (t["toxicity"] = 0.8) },
  { pattern: /ينتشر|spread|غازي|invasive/i, apply: (t) => (t["spreadRate"] = 0.85) },
  { pattern: /مرن|متكيف|adapt|resilien/i, apply: (t) => (t["adaptability"] = 0.85) },
  { pattern: /طويل العمر|long.?liv|immortal|خالد/i, apply: (t) => (t["lifespan"] = 0.9) },
];

const CATEGORY_BIOMES: Record<ContributionCategory, string[]> = {
  [ContributionCategory.Plant]: ["temperate_forest", "rainforest", "plains"],
  [ContributionCategory.Creature]: ["plains", "temperate_forest", "steppe"],
  [ContributionCategory.Resource]: ["mountains", "volcanic", "desert"],
  [ContributionCategory.Civilization]: ["plains", "coast"],
  [ContributionCategory.Invention]: ["plains", "coast"],
  [ContributionCategory.NaturalPhenomenon]: ["volcanic", "ocean", "mountains"],
  [ContributionCategory.Disease]: ["swamp", "coast"],
  [ContributionCategory.Culture]: ["plains", "coast"],
  [ContributionCategory.WorldLaw]: [],
  [ContributionCategory.Custom]: ["plains"],
};

export class MockProvider implements LLMProvider {
  name = "mock";

  isLive(): boolean {
    return false; // sandbox by definition
  }

  async analyze(req: AnalyzeRequest): Promise<AnalyzedContribution> {
    const traits: Record<string, number> = {
      size: 0.5, growthRate: 0.5, waterNeed: 0.5, energyOutput: 0.1,
      pollutionAbsorption: 0, pollutionEmission: 0.1, coldResistance: 0.5,
      heatResistance: 0.5, aggression: 0.2, intelligence: 0.2,
      reproductionRate: 0.5, lifespan: 0.5, adaptability: 0.5, rarity: 0.5,
      nightLuminosity: 0, toxicity: 0, spreadRate: 0.5,
    };
    for (const { pattern, apply } of KEYWORD_MAP) {
      if (pattern.test(req.text)) apply(traits);
    }
    if (req.category === ContributionCategory.Civilization || req.category === ContributionCategory.Invention) {
      traits["intelligence"] = Math.max(traits["intelligence"]!, 0.6);
    }
    if (req.category === ContributionCategory.Disease) {
      traits["toxicity"] = Math.max(traits["toxicity"]!, 0.6);
      traits["spreadRate"] = Math.max(traits["spreadRate"]!, 0.6);
    }

    const risks: string[] = [];
    const benefits: string[] = [];
    if ((traits["waterNeed"] ?? 0) > 0.7) risks.push("high_water_consumption");
    if ((traits["reproductionRate"] ?? 0) > 0.8) risks.push("ecosystem_competition");
    if ((traits["aggression"] ?? 0) > 0.7) risks.push("predation_pressure");
    if ((traits["pollutionEmission"] ?? 0) > 0.5) risks.push("pollution_burden");
    if ((traits["energyOutput"] ?? 0) > 0.6) risks.push("resource_conflict");
    if ((traits["pollutionAbsorption"] ?? 0) > 0.5) benefits.push("pollution_reduction");
    if ((traits["energyOutput"] ?? 0) > 0.5) benefits.push("energy_supply");
    if ((traits["nightLuminosity"] ?? 0) > 0.5) benefits.push("nighttime_visibility");

    return {
      category: req.category,
      name: deriveName(req.text, req.locale),
      summary: req.text.slice(0, 500),
      traits: traits as unknown as AnalyzedContribution["traits"],
      possibleBiomes: CATEGORY_BIOMES[req.category] ?? [],
      risks,
      benefits,
      sandbox: true,
    };
  }

  async narrate(req: NarrateRequest): Promise<NarrateResult> {
    const parts: string[] = [];
    for (const fact of req.facts.slice(0, 12)) {
      parts.push(formatFact(req.locale, fact));
    }
    return {
      text: parts.filter(Boolean).join(req.locale === "ar" ? " " : " "),
      llmGenerated: false,
    };
  }
}

function deriveName(text: string, locale: "ar" | "en"): string {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  if (words.length === 0) return locale === "ar" ? "عنصر جديد" : "New Element";
  return words.join(" ").slice(0, 60);
}

function formatFact(locale: "ar" | "en", fact: NarrateRequest["facts"][number]): string {
  const name = fact.names?.["name"] ?? "";
  const pct = (k: string) => {
    const v = fact.numbers?.[k];
    return v !== undefined ? `${Math.round(v * 100)}%` : "";
  };
  if (locale === "ar") {
    switch (fact.type) {
      case "PLANT_SPREAD": return `انتشر «${name}» في مناطق جديدة بحلول العام ${fact.year}.`;
      case "SPECIES_EXTINCT": return `انقرض «${name}» في العام ${fact.year}.`;
      case "POLLUTION_REDUCED": return `انخفض التلوث بنسبة ${pct("amount")} بفضل «${name}».`;
      case "WAR_STARTED": return `اندلعت حرب في العام ${fact.year} بسبب ${fact.names?.["reason"] ?? "توترات"} بين ${fact.names?.["attacker"] ?? ""} و${fact.names?.["defender"] ?? ""}.`;
      case "TRADE_ROUTE_CREATED": return `نشأ طريق تجاري بين ${fact.names?.["from"] ?? ""} و${fact.names?.["to"] ?? ""}.`;
      case "CIVILIZATION_FOUNDED": return `ظهرت حضارة ${name} في العام ${fact.year}.`;
      case "TECHNOLOGY_DISCOVERED": return `اكتُشفت تقنية ${name} في العام ${fact.year}.`;
      default: return `في العام ${fact.year}: ${fact.type}.`;
    }
  }
  switch (fact.type) {
    case "PLANT_SPREAD": return `By year ${fact.year}, "${name}" had spread into new regions.`;
    case "SPECIES_EXTINCT": return `"${name}" went extinct in year ${fact.year}.`;
    case "POLLUTION_REDUCED": return `Pollution fell by ${pct("amount")} thanks to "${name}".`;
    case "WAR_STARTED": return `War broke out in year ${fact.year} between ${fact.names?.["attacker"] ?? ""} and ${fact.names?.["defender"] ?? ""}.`;
    case "TRADE_ROUTE_CREATED": return `A trade route formed between ${fact.names?.["from"] ?? ""} and ${fact.names?.["to"] ?? ""}.`;
    case "CIVILIZATION_FOUNDED": return `The civilization of ${name} arose in year ${fact.year}.`;
    case "TECHNOLOGY_DISCOVERED": return `${name} was discovered in year ${fact.year}.`;
    default: return `Year ${fact.year}: ${fact.type}.`;
  }
}
