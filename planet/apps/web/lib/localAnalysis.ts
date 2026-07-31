"use client";

import {
  ContributionCategory,
  type AnalyzedContribution,
  type BalanceResult,
  type ContributionPreview,
} from "@planet/shared-types";

/**
 * Local-preview fallbacks used ONLY when the API is unreachable
 * (local-preview mode, explicitly labeled in the UI). Mirrors the
 * orchestrator's sandbox rules without pretending to be live AI.
 */
export const MockAnalyzerLocal = {
  analyze(category: ContributionCategory, text: string): AnalyzedContribution {
    const t = (v: Partial<AnalyzedContribution["traits"]>): AnalyzedContribution["traits"] => ({
      size: 0.5, growthRate: 0.5, waterNeed: 0.5, energyOutput: 0.1,
      pollutionAbsorption: 0, pollutionEmission: 0.1, coldResistance: 0.5,
      heatResistance: 0.5, aggression: 0.2, intelligence: 0.2, reproductionRate: 0.5,
      lifespan: 0.5, adaptability: 0.5, rarity: 0.5, nightLuminosity: 0,
      toxicity: 0, spreadRate: 0.5, ...v,
    });
    const traits = t({});
    if (/عملاق|ضخم|giant/i.test(text)) traits.size = 0.9;
    if (/[يت]متص|تنقية|absorb/i.test(text)) traits.pollutionAbsorption = 0.9;
    if (/[يت]ضيء|مضيء|توهج|glow/i.test(text)) traits.nightLuminosity = 0.85;
    if (/ماء|water|نهر/i.test(text)) traits.waterNeed = 0.8;
    if (/طاقة|energy|شمس/i.test(text)) traits.energyOutput = 0.8;
    if (/شرس|عدواني|مفترس/i.test(text)) traits.aggression = 0.8;
    if (/ذكي|intelligent/i.test(text)) traits.intelligence = 0.8;
    const risks: string[] = [];
    if (traits.waterNeed > 0.7) risks.push("high_water_consumption");
    if (traits.energyOutput > 0.6) risks.push("resource_conflict");
    return {
      category,
      name: text.split(/\s+/).slice(0, 3).join(" ").slice(0, 60) || "عنصر جديد",
      summary: text.slice(0, 300),
      traits,
      possibleBiomes: ["plains", "temperate_forest"],
      risks,
      benefits: traits.pollutionAbsorption > 0.5 ? ["pollution_reduction"] : [],
      sandbox: true,
    };
  },

  balance(text: string, analysis: AnalyzedContribution): BalanceResult {
    if (/لا يموت|خالد|immortal/i.test(text)) {
      return {
        verdict: "adjust",
        reasons: ["immortality_forbidden"],
        adjustedTraits: { ...analysis.traits, lifespan: 0.95 },
        suggestions: ["long_lived_instead"],
      };
    }
    if (/[يت]دمر الكوكب|destroy the planet/i.test(text)) {
      return { verdict: "reject", reasons: ["instant_destruction_forbidden"] };
    }
    return { verdict: "accept", reasons: [] };
  },

  preview(analysis: AnalyzedContribution, cell: number): ContributionPreview {
    const horizon = (years: number, drift: number) => ({
      years,
      likelihood: 0.7 - drift,
      uncertainty: 0.15 + drift,
      summary: {
        biosphereHealth: 0.6 + analysis.traits.growthRate * 0.2 - drift,
        civProsperity: 0.55,
        pollution: Math.max(0, 0.2 - analysis.traits.pollutionAbsorption * 0.15 + drift * 0.3),
        population: 50000 + years * 100,
        notableEvents: [],
      },
      best: {
        biosphereHealth: 0.8, civProsperity: 0.75, pollution: 0.1, population: 80000 + years * 120,
        notableEvents: [],
      },
      worst: {
        biosphereHealth: 0.35, civProsperity: 0.3, pollution: 0.5, population: 30000,
        notableEvents: [],
      },
      keyFactors: analysis.risks.slice(0, 2).length > 0 ? analysis.risks.slice(0, 2) : ["stable_conditions"],
    });
    return {
      successProbability: 0.75,
      suitableBiomes: analysis.possibleBiomes,
      environmentalImpact: analysis.traits.pollutionAbsorption * 0.7 + 0.2,
      economicImpact: analysis.traits.energyOutput * 0.6 + 0.1,
      risks: analysis.risks,
      beneficiaryCivs: [],
      horizons: [horizon(1, 0), horizon(10, 0.05), horizon(100, 0.15), horizon(1000, 0.3)],
    };
    void cell;
  },
};
