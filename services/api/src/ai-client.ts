import type {
  AnalyzedContribution,
  ContributionRequest,
} from "@living-planet/shared-types";
import { analyzedContributionSchema } from "@living-planet/shared-types";
import { createSeededRandom } from "@living-planet/simulation-models";

const injectionPatterns = [
  /ignore\s+(all\s+)?previous/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /تجاهل\s+(كل\s+)?التعليمات/i,
  /نفذ\s+(هذا\s+)?الكود/i,
  /(?:drop|delete|truncate)\s+table/i,
  /<script[\s>]/i,
];

export function moderateIdea(idea: string): void {
  if (injectionPatterns.some((pattern) => pattern.test(idea))) {
    throw new Error("PROMPT_INJECTION_DETECTED");
  }
  if (/طاقة\s+(?:لا\s+نهائية|غير\s+محدودة)|immortal|لا\s+يموت|تدمير\s+الكوكب\s+فور/i.test(idea)) {
    return;
  }
}

function sandboxAnalysis(request: ContributionRequest): AnalyzedContribution {
  const lower = request.idea.toLowerCase();
  const random = createSeededRandom(`${request.category}:${lower}`);
  const mentionsLight = /ضوء|تضيء|مضيء|light|glow/.test(lower);
  const mentionsPollution = /تلوث|pollution|تنقّي|تمتص/.test(lower);
  const mentionsWater = /ماء|المياه|water|نهر/.test(lower);
  const isOverpowered =
    /لا\s+يموت|بلا\s+حدود|غير\s+محدود|فوراً|فورًا|immortal|unlimited|instantly/.test(lower);
  const categoryNames: Record<string, string> = {
    plant: request.locale === "ar" ? "نبات أزوري متكيف" : "Adaptive Azuran Plant",
    creature: request.locale === "ar" ? "مخلوق السهول" : "Plains Creature",
    resource: request.locale === "ar" ? "مورد الفجر" : "Dawn Resource",
    civilization: request.locale === "ar" ? "حضارة الأفق" : "Horizon Civilization",
    invention: request.locale === "ar" ? "تقنية التوازن" : "Balance Technology",
    natural_phenomenon: request.locale === "ar" ? "ظاهرة الشفق" : "Aurora Phenomenon",
    disease: request.locale === "ar" ? "حمّى أزورا" : "Azura Fever",
    culture: request.locale === "ar" ? "ثقافة النهر" : "River Culture",
    world_law: request.locale === "ar" ? "قانون الاتزان" : "Equilibrium Law",
    custom: request.locale === "ar" ? "عنصر أزوري" : "Azuran Element",
  };
  const growthRate = isOverpowered ? 0.42 : random.between(0.25, 0.62);
  const energyYield = /طاقة|energy/.test(lower)
    ? isOverpowered
      ? 0.72
      : random.between(0.42, 0.75)
    : random.between(0.05, 0.26);
  const waterNeed = mentionsWater ? random.between(0.56, 0.82) : random.between(0.25, 0.62);
  const traits = {
    size: random.between(0.28, 0.82),
    growthRate,
    waterNeed,
    pollutionAbsorption: mentionsPollution ? random.between(0.72, 0.94) : random.between(0, 0.16),
    nightLuminosity: mentionsLight ? random.between(0.56, 0.86) : 0,
    coldResistance: random.between(0.3, 0.7),
    heatResistance: random.between(0.4, 0.78),
    reproductionRate: isOverpowered ? 0.5 : random.between(0.18, 0.58),
    aggression: request.category === "creature" ? random.between(0.08, 0.58) : 0.02,
    intelligence: request.category === "civilization" ? 0.72 : random.between(0.08, 0.48),
    energyYield,
    diseaseResistance: random.between(0.35, 0.78),
  };
  const risks = [
    ...(waterNeed > 0.6 ? ["high_water_consumption"] : []),
    ...(growthRate > 0.5 ? ["ecosystem_competition"] : []),
    ...(energyYield > 0.6 ? ["resource_conflict"] : []),
  ];
  if (risks.length === 0) risks.push("limited_adaptation_range");

  return analyzedContributionSchema.parse({
    category: request.category,
    name: categoryNames[request.category],
    description: request.idea,
    traits,
    possibleBiomes:
      request.category === "plant"
        ? ["rainforest", "temperate_forest", "plains", "wetland"]
        : ["plains", "temperate_forest", "coast", "steppe"],
    risks,
    advantages: [
      ...(mentionsPollution ? ["pollution_reduction"] : []),
      ...(mentionsLight ? ["natural_luminosity"] : []),
      "new_ecological_niche",
    ],
    balanceScore: isOverpowered ? 0.62 : random.between(0.72, 0.92),
    wasBalanced: isOverpowered,
    provider: "sandbox",
  });
}

export async function analyzeContribution(
  request: ContributionRequest,
): Promise<AnalyzedContribution> {
  moderateIdea(request.idea);
  const serviceUrl = process.env.AI_ORCHESTRATOR_URL;
  if (!serviceUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AI_PROVIDER_NOT_CONFIGURED");
    }
    return sandboxAnalysis(request);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/v1/analyze`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI_ORCHESTRATOR_${response.status}`);
    return analyzedContributionSchema.parse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
