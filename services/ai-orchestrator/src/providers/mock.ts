import type { Biome, ContributionCategory } from "@planet/config";
import type { StructuredContribution } from "@planet/shared-types";
import { balanceContribution } from "@planet/simulation-models";
import type { AiProvider } from "./types.js";

function detectBiomes(idea: string): Biome[] {
  const biomes: Biome[] = [];
  if (/غابة|forest|شجرة|tree/i.test(idea)) {
    biomes.push("temperate_forest", "rainforest");
  }
  if (/صحراء|desert/i.test(idea)) biomes.push("desert");
  if (/قطب|ثلج|ice|tundra/i.test(idea)) biomes.push("tundra", "ice");
  if (/ساحل|ocean|بحر/i.test(idea)) biomes.push("coast");
  if (!biomes.length) biomes.push("plains", "temperate_forest");
  return [...new Set(biomes)];
}

function inferTraits(idea: string, category: ContributionCategory) {
  const traits: Record<string, number> = {
    size: /عملاق|giant|huge/i.test(idea) ? 0.9 : 0.45,
    growthRate: /سريع|fast|spread/i.test(idea) ? 0.55 : 0.3,
    waterNeed: /ماء|water|نهر/i.test(idea) ? 0.7 : 0.4,
    pollutionAbsorption: /تلوث|pollution/i.test(idea) ? 0.9 : 0.15,
    nightLuminosity: /يضيء|light|ليل|glow/i.test(idea) ? 0.8 : 0.05,
    heatResistance: /حر|heat|صحراء/i.test(idea) ? 0.75 : 0.45,
    coldResistance: /برد|cold|ثلج/i.test(idea) ? 0.75 : 0.4,
    aggression: /حرب|عدوان|predator|مفترس/i.test(idea) ? 0.7 : 0.25,
    intelligence: /ذكي|علم|tech|ذكاء/i.test(idea) ? 0.7 : 0.35,
    adaptability: 0.5,
    reproduction: category === "creature" ? 0.35 : 0.2,
  };
  return traits;
}

function nameFromIdea(idea: string, locale: "ar" | "en"): { name: string; nameEn: string } {
  if (/شجرة|tree/i.test(idea) && /ضوء|light|تلوث|pollution/i.test(idea)) {
    return { name: "شجرة الضوء العملاقة", nameEn: "Giant Light Tree" };
  }
  const short = idea.trim().slice(0, 42);
  return {
    name: locale === "ar" ? short : `Element: ${short}`,
    nameEn: locale === "en" ? short : `Element: ${short}`,
  };
}

export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly sandbox = true;

  async parseIdea(input: {
    category: string;
    idea: string;
    locale: "ar" | "en";
  }): Promise<StructuredContribution> {
    const category = input.category as ContributionCategory;
    const names = nameFromIdea(input.idea, input.locale);
    const structured: StructuredContribution = {
      category,
      name: names.name,
      nameEn: names.nameEn,
      description: input.idea,
      traits: inferTraits(input.idea, category),
      possibleBiomes: detectBiomes(input.idea),
      risks: [],
      benefits: [],
      balanceNotes: ["Sandbox AI provider — deterministic structured extraction."],
      wasBalanced: false,
      originalIdea: input.idea,
    };

    if (structured.traits.pollutionAbsorption! > 0.5) {
      structured.benefits.push("pollution_reduction");
    }
    if (structured.traits.nightLuminosity! > 0.5) {
      structured.benefits.push("night_illumination");
    }
    if (structured.traits.waterNeed! > 0.65) {
      structured.risks.push("high_water_consumption");
    }
    if (structured.traits.aggression! > 0.6) {
      structured.risks.push("conflict_risk");
    }
    structured.risks.push("ecosystem_competition");

    return balanceContribution(structured);
  }

  async narrate(input: {
    locale: "ar" | "en";
    contributionName: string;
    effects: { domain: string; metric: string; delta: number }[];
    eventTitles: string[];
  }) {
    // Strict grounding: only mention provided effects/events.
    const effectLinesAr = input.effects
      .slice(0, 6)
      .map(
        (e) =>
          `${e.domain}/${e.metric}: ${e.delta >= 0 ? "+" : ""}${(e.delta * 100).toFixed(1)}%`,
      );
    const effectLinesEn = effectLinesAr;

    const narrative = [
      `بدأت «${input.contributionName}» بالتأثير وفق نتائج المحاكاة.`,
      ...effectLinesAr.map((l) => `• ${l}`),
      input.eventTitles.length
        ? `الأحداث المرتبطة: ${input.eventTitles.slice(0, 4).join("، ")}.`
        : "لم تُسجَّل أحداث إضافية بعد.",
    ].join(" ");

    const narrativeEn = [
      `"${input.contributionName}" began influencing the world according to simulation results.`,
      ...effectLinesEn.map((l) => `• ${l}`),
      input.eventTitles.length
        ? `Related events: ${input.eventTitles.slice(0, 4).join(", ")}.`
        : "No additional events recorded yet.",
    ].join(" ");

    return { narrative, narrativeEn };
  }
}
