import { z } from "zod";

import type {
  Biome,
  ContributionAnalysis,
  ContributionCategory,
  ContributionTraits,
} from "./types";
import { clamp, round } from "./world-generator";

const categories = [
  "creature",
  "plant",
  "resource",
  "civilization",
  "invention",
  "phenomenon",
  "disease",
  "culture",
  "law",
  "custom",
] as const;

const biomes = [
  "ocean",
  "coast",
  "plains",
  "rainforest",
  "temperate_forest",
  "desert",
  "mountain",
  "tundra",
  "wetland",
  "steppe",
  "volcanic",
  "ice",
] as const;

export const contributionAnalysisSchema = z.object({
  provider: z.enum(["sandbox", "openai", "anthropic", "gemini", "local"]),
  category: z.enum(categories),
  name: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(5).max(500),
  traits: z.object({
    size: z.number().min(0).max(1),
    growthRate: z.number().min(0).max(1),
    waterNeed: z.number().min(0).max(1),
    pollutionAbsorption: z.number().min(0).max(1),
    nightLuminosity: z.number().min(0).max(1),
    coldResistance: z.number().min(0).max(1),
    heatResistance: z.number().min(0).max(1),
    adaptability: z.number().min(0).max(1),
    aggression: z.number().min(0).max(1),
    economicValue: z.number().min(0).max(1),
  }),
  possibleBiomes: z.array(z.enum(biomes)).min(1).max(6),
  benefits: z.array(z.string().min(2).max(180)).max(8),
  risks: z.array(z.string().min(2).max(180)).max(8),
  balanceAdjustments: z.array(z.string().min(2).max(180)).max(8),
  confidence: z.number().min(0).max(1),
});

const prohibitedPatterns = [
  /<script/iu,
  /\b(drop|alter|delete)\s+(table|database)\b/iu,
  /\b(system|developer)\s+prompt\b/iu,
  /تجاهل\s+(كل\s+)?التعليمات/iu,
  /نفذ\s+(هذا\s+)?(?:الكود|الأمر)/iu,
  /\b(?:rm\s+-rf|sudo|eval\s*\()/iu,
];

const omnipotentPatterns = [
  /لا\s+(?:يموت|ينتهي|يفنى)/iu,
  /طاقة\s+(?:بلا|غير)\s+محدود/iu,
  /يتكاثر\s+(?:بلا|دون)\s+حدود/iu,
  /يدمر\s+الكوكب\s+(?:فور|حال)/iu,
  /\b(?:immortal|infinite energy|unlimited reproduction|destroy the planet instantly)\b/iu,
];

export interface ModerationResult {
  accepted: boolean;
  code: "accepted" | "empty" | "too_long" | "unsafe_instruction";
  messageAr: string;
  messageEn: string;
}

export function moderateContributionText(text: string): ModerationResult {
  const value = text.trim();
  if (value.length < 8) {
    return {
      accepted: false,
      code: "empty",
      messageAr: "اكتب وصفًا أوضح للفكرة لا يقل عن 8 أحرف.",
      messageEn: "Describe the idea in at least 8 characters.",
    };
  }
  if (value.length > 700) {
    return {
      accepted: false,
      code: "too_long",
      messageAr: "الوصف أطول من الحد المسموح (700 حرف).",
      messageEn: "The description exceeds the 700 character limit.",
    };
  }
  if (prohibitedPatterns.some((pattern) => pattern.test(value))) {
    return {
      accepted: false,
      code: "unsafe_instruction",
      messageAr: "يحتوي النص على تعليمات برمجية أو محاولة للتحكم بالنظام.",
      messageEn: "The text contains executable instructions or an attempt to control the system.",
    };
  }
  return {
    accepted: true,
    code: "accepted",
    messageAr: "اجتاز النص الفحص المحلي.",
    messageEn: "The text passed local moderation.",
  };
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function inferredName(text: string, category: ContributionCategory) {
  const quoted = text.match(/[«"“]([^»"”]{2,60})[»"”]/u)?.[1]?.trim();
  if (quoted) return quoted;
  const afterNamed = text.match(/(?:اسمها|اسمه|تسمى|يدعى|called)\s+([\p{L}\s-]{2,45})/iu)?.[1]?.trim();
  if (afterNamed) return afterNamed.replace(/[.،,].*$/u, "").trim();
  const names: Record<ContributionCategory, string> = {
    creature: "مخلوق متكيف",
    plant: "نبات الضوء",
    resource: "مورد جديد",
    civilization: "حضارة ناشئة",
    invention: "اختراع مستدام",
    phenomenon: "ظاهرة مناخية",
    disease: "عامل مرضي",
    culture: "ثقافة عابرة",
    law: "قانون عالمي",
    custom: "عنصر جديد",
  };
  return names[category];
}

function baseTraits(category: ContributionCategory): ContributionTraits {
  const common: ContributionTraits = {
    size: 0.35,
    growthRate: 0.32,
    waterNeed: 0.4,
    pollutionAbsorption: 0.08,
    nightLuminosity: 0,
    coldResistance: 0.4,
    heatResistance: 0.45,
    adaptability: 0.42,
    aggression: 0.12,
    economicValue: 0.36,
  };
  if (category === "plant") return { ...common, growthRate: 0.48, waterNeed: 0.57 };
  if (category === "creature") return { ...common, adaptability: 0.55, aggression: 0.34 };
  if (category === "resource") return { ...common, growthRate: 0.05, economicValue: 0.76 };
  if (category === "invention") {
    return { ...common, growthRate: 0.62, waterNeed: 0.06, economicValue: 0.82 };
  }
  if (category === "disease") {
    return { ...common, growthRate: 0.68, adaptability: 0.63, aggression: 0.72, economicValue: 0.02 };
  }
  if (category === "civilization") {
    return { ...common, size: 0.62, adaptability: 0.67, aggression: 0.38, economicValue: 0.71 };
  }
  return common;
}

function inferBiomes(traits: ContributionTraits, category: ContributionCategory): Biome[] {
  if (category === "resource") return ["mountain", "volcanic", "desert", "steppe"];
  if (category === "phenomenon") return ["ocean", "coast", "plains", "desert"];
  if (traits.coldResistance > 0.7) return ["tundra", "ice", "mountain", "steppe"];
  if (traits.heatResistance > 0.72 && traits.waterNeed < 0.35) return ["desert", "steppe", "plains"];
  if (traits.waterNeed > 0.7) return ["rainforest", "wetland", "temperate_forest", "coast"];
  return ["temperate_forest", "plains", "rainforest", "coast"];
}

function normalizeTraits(traits: ContributionTraits) {
  return Object.fromEntries(
    Object.entries(traits).map(([key, value]) => [key, round(clamp(value))]),
  ) as unknown as ContributionTraits;
}

/**
 * Deterministic, offline analyzer used when no external provider is configured.
 * It never presents itself as an LLM and always validates its structured output.
 */
export function analyzeContributionSandbox(
  sourceText: string,
  category: ContributionCategory,
): ContributionAnalysis {
  const moderation = moderateContributionText(sourceText);
  if (!moderation.accepted) throw new Error(moderation.code);

  const text = sourceText.toLocaleLowerCase("ar");
  const traits = baseTraits(category);
  const benefits: string[] = [];
  const risks: string[] = [];
  const balanceAdjustments: string[] = [];

  if (includesAny(text, ["عملاق", "ضخم", "giant", "huge"])) traits.size = 0.9;
  if (includesAny(text, ["سريع", "ينتشر", "يتكاثر", "rapid", "spread"])) traits.growthRate += 0.25;
  if (includesAny(text, ["يمتص التلوث", "تنقية", "تلوث", "pollution", "purif"])) {
    traits.pollutionAbsorption = 0.9;
    benefits.push("خفض التلوث في مناطق الانتشار");
  }
  if (includesAny(text, ["يضيء", "مضيء", "الليل", "glow", "luminous"])) {
    traits.nightLuminosity = 0.82;
    benefits.push("إضاءة حيوية منخفضة الانبعاثات");
  }
  if (includesAny(text, ["ماء كثير", "يستهلك الماء", "high water", "water-intensive"])) {
    traits.waterNeed = 0.86;
  }
  if (includesAny(text, ["قليل الماء", "الجفاف", "drought", "low water"])) {
    traits.waterNeed = 0.18;
    traits.heatResistance += 0.24;
  }
  if (includesAny(text, ["بارد", "ثلج", "صقيع", "cold", "frost"])) traits.coldResistance += 0.3;
  if (includesAny(text, ["حرارة", "حار", "صحراء", "heat", "desert"])) traits.heatResistance += 0.28;
  if (includesAny(text, ["ذكي", "يتعلم", "intelligent", "learn"])) traits.adaptability += 0.27;
  if (includesAny(text, ["عدوان", "يفترس", "سام", "aggress", "predator", "toxic"])) {
    traits.aggression += 0.42;
  }
  if (includesAny(text, ["طاقة", "صناعة", "اقتصاد", "energy", "industry", "economic"])) {
    traits.economicValue += 0.31;
    benefits.push("قيمة اقتصادية قابلة للاستثمار");
  }

  if (traits.waterNeed > 0.7) risks.push("ضغط مرتفع على المياه السطحية");
  if (traits.growthRate > 0.62) risks.push("منافسة الأنواع المحلية على الموائل");
  if (traits.aggression > 0.62) risks.push("اضطراب محتمل في السلسلة الغذائية أو الاستقرار");
  if (traits.economicValue > 0.7) risks.push("تنافس حضاري محتمل على مناطق السيطرة");
  if (traits.pollutionAbsorption > 0.65 && traits.waterNeed > 0.6) {
    risks.push("نقل جزء من العبء البيئي من الهواء إلى موارد المياه");
  }
  if (benefits.length === 0) benefits.push("زيادة تنوع النظام العالمي ضمن البيئات الملائمة");
  if (risks.length === 0) risks.push("عدم يقين تكيفي يتطلب مراقبة بعد الإطلاق");

  if (omnipotentPatterns.some((pattern) => pattern.test(text))) {
    traits.growthRate = Math.min(traits.growthRate, 0.58);
    traits.adaptability = Math.min(traits.adaptability, 0.76);
    traits.economicValue = Math.min(traits.economicValue, 0.84);
    balanceAdjustments.push("استبدال الخاصية المطلقة بقدرة محدودة تخضع للموارد والقدرة الاستيعابية");
  }
  if (traits.growthRate > 0.82) {
    traits.growthRate = 0.72;
    balanceAdjustments.push("تخفيض سرعة الانتشار لمنع النمو غير المحدود");
  }

  const normalizedTraits = normalizeTraits(traits);
  const analysis: ContributionAnalysis = {
    provider: "sandbox",
    category,
    name: inferredName(sourceText, category),
    summary: sourceText.trim().replace(/\s+/gu, " ").slice(0, 500),
    traits: normalizedTraits,
    possibleBiomes: inferBiomes(normalizedTraits, category),
    benefits,
    risks,
    balanceAdjustments,
    confidence: 0.74,
  };
  return contributionAnalysisSchema.parse(analysis);
}
