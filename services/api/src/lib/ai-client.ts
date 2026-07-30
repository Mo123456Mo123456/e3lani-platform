import { loadConfig } from "@planet/config";
import type { StructuredContribution } from "@planet/shared-types";
import {
  balanceContribution,
  suggestBiomesFromText,
} from "@planet/simulation-models";
import { detectInjection, sanitizeUserText } from "@planet/validation";
import type { ContributionCategory } from "@planet/shared-types";

const config = loadConfig();

export interface AnalyzeIdeaInput {
  category: ContributionCategory;
  idea: string;
  locale: "ar" | "en";
}

export interface AnalyzeIdeaResult {
  structured: StructuredContribution;
  provider: string;
  sandbox: boolean;
  moderation: { allowed: boolean; reasons: string[] };
  narrativeHint?: string;
}

/** Call AI orchestrator; fall back to local sandbox parser */
export async function analyzeIdea(input: AnalyzeIdeaInput): Promise<AnalyzeIdeaResult> {
  const idea = sanitizeUserText(input.idea);
  const injection = detectInjection(idea);
  if (injection) {
    return {
      structured: emptyStructured(input.category, idea),
      provider: "moderation",
      sandbox: true,
      moderation: {
        allowed: false,
        reasons: ["prompt_injection_or_forbidden_pattern"],
      },
    };
  }

  try {
    const res = await fetch(`${config.AI_ORCHESTRATOR_URL}/v1/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as AnalyzeIdeaResult;
      return data;
    }
  } catch {
    // fall through to sandbox
  }

  return localSandboxAnalyze(input.category, idea, input.locale);
}

export async function narrateFromEvents(payload: {
  events: Array<{ title: string; titleAr: string; description: string; descriptionAr: string; type: string }>;
  locale: "ar" | "en";
}): Promise<{ narrative: string; narrativeAr: string; provider: string; sandbox: boolean }> {
  try {
    const res = await fetch(`${config.AI_ORCHESTRATOR_URL}/v1/narrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return (await res.json()) as {
      narrative: string;
      narrativeAr: string;
      provider: string;
      sandbox: boolean;
    };
  } catch {
    /* sandbox */
  }

  const narrative = payload.events
    .slice(0, 5)
    .map((e) => e.description)
    .join(" ");
  const narrativeAr = payload.events
    .slice(0, 5)
    .map((e) => e.descriptionAr)
    .join(" ");
  return {
    narrative: narrative || "Simulation produced measurable changes.",
    narrativeAr: narrativeAr || "أنتجت المحاكاة تغيرات قابلة للقياس.",
    provider: "sandbox",
    sandbox: true,
  };
}

function localSandboxAnalyze(
  category: ContributionCategory,
  idea: string,
  locale: "ar" | "en",
): AnalyzeIdeaResult {
  const isAr = /[\u0600-\u06FF]/.test(idea) || locale === "ar";
  const nameAr = deriveName(idea, true);
  const nameEn = deriveName(idea, false);
  const biomes = suggestBiomesFromText(idea);
  const traits: Record<string, number> = {
    size: clamp01(score(idea, /عملاق|giant|ضخم/i, 0.85, 0.4)),
    growthRate: clamp01(score(idea, /سريع|fast|ينمو/i, 0.55, 0.3)),
    waterNeed: clamp01(score(idea, /ماء|water|نهر/i, 0.75, 0.45)),
    pollutionAbsorption: clamp01(score(idea, /تلوث|pollution|ينظّف|ينظف/i, 0.9, 0.1)),
    nightLuminosity: clamp01(score(idea, /يضيء|light|ليل|glow/i, 0.8, 0.05)),
    energyOutput: clamp01(score(idea, /طاقة|energy|شمس|solar/i, 0.7, 0.05)),
    coldResistance: clamp01(score(idea, /برد|cold|ثلج/i, 0.7, 0.3)),
    heatResistance: clamp01(score(idea, /حر|heat|صحر/i, 0.7, 0.4)),
    aggression: clamp01(score(idea, /عدوان|attack|مفترس/i, 0.7, 0.2)),
    intelligence: clamp01(score(idea, /ذكي|smart|علم/i, 0.7, 0.3)),
    economicValue: clamp01(score(idea, /تجارة|trade|ثروة/i, 0.7, 0.3)),
    contagiousness: category === "disease" ? 0.45 : 0,
    lethality: category === "disease" ? 0.25 : 0,
  };

  const risks: string[] = [];
  if (traits.waterNeed > 0.65) risks.push("high_water_consumption");
  if (traits.growthRate > 0.5) risks.push("ecosystem_competition");
  if (traits.energyOutput > 0.5) risks.push("resource_conflict");
  if (category === "disease") risks.push("outbreak_risk");

  const benefits: string[] = [];
  if (traits.pollutionAbsorption > 0.4) benefits.push("pollution_reduction");
  if (traits.energyOutput > 0.3) benefits.push("energy_potential");
  if (traits.nightLuminosity > 0.3) benefits.push("night_visibility");

  const structured = balanceContribution({
    category,
    name: nameEn,
    nameAr,
    description: isAr ? `تحليل محلي: ${idea}` : `Sandbox parse: ${idea}`,
    descriptionAr: `تحليل صندوق الرمل: ${idea}`,
    traits,
    possibleBiomes: biomes,
    risks,
    benefits,
    balanceNotes: [],
    wasBalanced: false,
    originalIdea: idea,
  });

  return {
    structured,
    provider: "sandbox",
    sandbox: true,
    moderation: { allowed: true, reasons: [] },
  };
}

function emptyStructured(category: ContributionCategory, idea: string): StructuredContribution {
  return {
    category,
    name: "Rejected",
    nameAr: "مرفوض",
    description: "Rejected by moderation",
    descriptionAr: "مرفوض بواسطة الإشراف",
    traits: {},
    possibleBiomes: [],
    risks: ["moderation_block"],
    benefits: [],
    balanceNotes: [],
    wasBalanced: false,
    originalIdea: idea,
  };
}

function deriveName(idea: string, ar: boolean): string {
  const trimmed = idea.replace(/\s+/g, " ").trim();
  const slice = trimmed.slice(0, 32);
  if (ar) return slice || "عنصر جديد";
  return slice || "New Element";
}

function score(text: string, re: RegExp, hit: number, miss: number): number {
  return re.test(text) ? hit : miss;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
