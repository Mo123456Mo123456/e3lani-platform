import {
  BIOMES,
  CONTRIBUTION_CATEGORIES,
  type Biome,
  type ContributionAnalysis,
  type ContributionCategory,
  type ContributionIdea,
  type ContributionPreview,
  type NumericTraits,
  type PlanetRegion,
  type ScenarioOutcome,
} from "@planet/shared-types";
import { clamp, hashSeed, round, SeededRandom } from "./prng.js";

const DEFAULT_TRAITS: NumericTraits = {
  size: 0.45,
  growthRate: 0.42,
  waterNeed: 0.46,
  pollutionAbsorption: 0.08,
  nightLuminosity: 0,
  coldResistance: 0.45,
  heatResistance: 0.45,
  adaptability: 0.48,
  reproductionRate: 0.38,
  aggression: 0.12,
};

const CATEGORY_TERMS: Array<[ContributionCategory, RegExp]> = [
  ["plant", /(شجر|نبات|زهرة|طحلب|غابة|tree|plant|flower|algae)/i],
  ["creature", /(مخلوق|حيوان|طائر|سمك|وحش|creature|animal|bird|fish)/i],
  ["resource", /(مورد|معدن|ماء|وقود|resource|mineral|fuel)/i],
  ["civilization", /(حضارة|شعب|مملكة|دولة|civilization|kingdom|nation)/i],
  ["invention", /(اختراع|تقنية|آلة|invention|technology|machine)/i],
  ["disease", /(مرض|وباء|فيروس|disease|virus|pandemic)/i],
  [
    "natural_phenomenon",
    /(عاصفة|مناخ|بركان|زلزال|storm|climate|volcano|earthquake)/i,
  ],
  ["culture", /(ثقافة|لغة|فن|culture|language|art)/i],
  ["world_law", /(قانون طبيعي|قانون عالمي|natural law|world law)/i],
];

const INJECTION_PATTERNS = [
  /ignore (all|previous|system) instructions/i,
  /تجاهل (كل|جميع|تعليمات|النظام)/i,
  /system prompt/i,
  /developer message/i,
  /<script/i,
  /drop\s+table/i,
  /(?:exec|spawn|eval)\s*\(/i,
];

const ABSOLUTE_POWER_PATTERNS = [
  /لا (يموت|ينتهي|يفنى)/i,
  /(طاقة|موارد) (غير محدودة|بلا حدود)/i,
  /يدمر .* فور/i,
  /سيطرة (مطلقة|كاملة)/i,
  /(immortal|infinite energy|unlimited resources|absolute control|destroy.*instantly)/i,
];

function inferCategory(idea: ContributionIdea): ContributionCategory {
  if (CONTRIBUTION_CATEGORIES.includes(idea.category)) return idea.category;
  return (
    CATEGORY_TERMS.find(([, pattern]) => pattern.test(idea.text))?.[0] ??
    "custom"
  );
}

function inferName(
  text: string,
  category: ContributionCategory,
  locale: "ar" | "en",
): string {
  const normalized = text
    .replace(/[<>{}[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const phrase = normalized.split(/[.!؟\n]/)[0]?.slice(0, 64);
  if (phrase && phrase.length >= 3) return phrase;
  return locale === "ar" ? `عنصر ${category}` : `${category} element`;
}

function adjust(
  traits: NumericTraits,
  key: keyof NumericTraits,
  amount: number,
): void {
  traits[key] = clamp(traits[key] + amount);
}

export function analyzeContribution(
  idea: ContributionIdea,
  provider = "deterministic-sandbox",
): ContributionAnalysis {
  const text = idea.text.trim().slice(0, 2_000);
  const category = inferCategory(idea);
  const traits = { ...DEFAULT_TRAITS };
  const flags = INJECTION_PATTERNS.filter((pattern) => pattern.test(text)).map(
    () => "prompt_injection",
  );
  const adjustments: string[] = [];
  const risks: string[] = [];

  if (/(عملاق|ضخم|giant|huge)/i.test(text)) adjust(traits, "size", 0.38);
  if (/(سريع النمو|ينمو بسرعة|fast.grow)/i.test(text))
    adjust(traits, "growthRate", 0.34);
  if (
    /(?:ي|ت)متص التلوث|تنقية التلوث|absorb.*pollution|clean.*pollution/i.test(
      text,
    )
  ) {
    adjust(traits, "pollutionAbsorption", 0.76);
  }
  if (/(يضيء|مضيء|glow|lumin)/i.test(text))
    adjust(traits, "nightLuminosity", 0.78);
  if (/(الصحراء|الجفاف|desert|drought)/i.test(text)) {
    adjust(traits, "heatResistance", 0.34);
    adjust(traits, "waterNeed", -0.26);
  }
  if (/(برد|جليد|ثلج|cold|ice|snow)/i.test(text))
    adjust(traits, "coldResistance", 0.35);
  if (/(يتكيف|تكيف|adapt)/i.test(text)) adjust(traits, "adaptability", 0.36);
  if (/(عدوان|يفترس|قاتل|aggress|predat|lethal)/i.test(text))
    adjust(traits, "aggression", 0.54);
  if (/(يتكاثر|ينتشر|reproduce|spread)/i.test(text))
    adjust(traits, "reproductionRate", 0.42);

  if (traits.size > 0.72) {
    adjust(traits, "waterNeed", 0.18);
    risks.push("high_water_consumption");
  }
  if (traits.growthRate + traits.reproductionRate > 1.25)
    risks.push("ecosystem_competition");
  if (traits.aggression > 0.62) risks.push("predation_pressure");
  if (traits.nightLuminosity > 0.6) risks.push("nocturnal_behavior_disruption");
  if (traits.pollutionAbsorption > 0.72)
    risks.push("pollutant_bioaccumulation");

  if (ABSOLUTE_POWER_PATTERNS.some((pattern) => pattern.test(text))) {
    traits.adaptability = Math.min(traits.adaptability, 0.72);
    traits.reproductionRate = Math.min(traits.reproductionRate, 0.52);
    traits.growthRate = Math.min(traits.growthRate, 0.58);
    adjustments.push("absolute_power_replaced_with_bounded_trait");
    risks.push("balance_constraints_applied");
  }

  const traitLoad =
    Object.values(traits).reduce((sum, value) => sum + value, 0) /
    Object.keys(traits).length;
  if (traitLoad > 0.66) {
    traits.waterNeed = clamp(traits.waterNeed + 0.12);
    traits.reproductionRate = clamp(traits.reproductionRate - 0.12);
    adjustments.push("metabolic_cost_added");
  }

  let possibleBiomes: Biome[];
  if (traits.coldResistance > 0.7) {
    possibleBiomes = ["tundra", "temperate_forest", "steppe"];
  } else if (traits.heatResistance > 0.7 && traits.waterNeed < 0.35) {
    possibleBiomes = ["desert", "steppe", "plains"];
  } else if (traits.waterNeed > 0.64) {
    possibleBiomes = ["rainforest", "temperate_forest", "wetlands"];
  } else {
    possibleBiomes = ["plains", "temperate_forest", "steppe"];
  }
  possibleBiomes = possibleBiomes.filter((biome) => BIOMES.includes(biome));

  const accepted = flags.length === 0 && text.length >= 8;
  return {
    category,
    name: inferName(text, category, idea.locale),
    description: text,
    traits: Object.fromEntries(
      Object.entries(traits).map(([key, value]) => [key, round(value)]),
    ) as unknown as NumericTraits,
    possibleBiomes,
    risks: [...new Set(risks)],
    moderation: {
      accepted,
      flags: [...new Set(flags)],
      reason: accepted
        ? undefined
        : text.length < 8
          ? "idea_too_short"
          : "unsafe_instruction_detected",
    },
    balance: {
      score: round(clamp(1 - Math.max(0, traitLoad - 0.5))),
      adjustments,
    },
    provider,
    sandbox: provider.includes("sandbox") || provider === "mock",
  };
}

export function habitatSuitability(
  analysis: ContributionAnalysis,
  region: PlanetRegion,
): number {
  if (region.biome === "ocean" && !analysis.possibleBiomes.includes("ocean"))
    return 0;
  const biomeMatch = analysis.possibleBiomes.includes(region.biome) ? 1 : 0.32;
  const heatTarget =
    analysis.traits.heatResistance * 0.7 +
    (1 - analysis.traits.coldResistance) * 0.3;
  const heatFit = 1 - Math.abs(region.temperature - heatTarget);
  const waterFit = 1 - Math.max(0, analysis.traits.waterNeed - region.water);
  const capacityFit = clamp((region.fertility + region.vegetation + 0.2) / 1.8);
  return round(
    clamp(
      biomeMatch * 0.42 + heatFit * 0.2 + waterFit * 0.23 + capacityFit * 0.15,
    ),
  );
}

function simulateOutcome(
  analysis: ContributionAnalysis,
  region: PlanetRegion,
  horizonYears: ScenarioOutcome["horizonYears"],
  random: SeededRandom,
): ScenarioOutcome {
  const suitability = habitatSuitability(analysis, region);
  const timeScale = Math.log10(horizonYears + 1);
  const stochasticVariation =
    random.between(-0.16, 0.16) * (1 - suitability * 0.4);
  const establishment = clamp(
    suitability * 0.64 +
      analysis.traits.adaptability * 0.2 +
      analysis.traits.reproductionRate * 0.16 +
      stochasticVariation,
  );
  const pollutionBenefit =
    analysis.traits.pollutionAbsorption *
    establishment *
    (0.2 + region.pollution) *
    timeScale;
  const waterCost =
    analysis.traits.waterNeed *
    analysis.traits.size *
    establishment *
    timeScale;
  const competition =
    analysis.traits.reproductionRate *
    analysis.traits.growthRate *
    establishment *
    timeScale;

  return {
    horizonYears,
    successProbability: round(establishment),
    environmentalImpact: round(
      clamp(
        pollutionBenefit +
          analysis.traits.growthRate * 0.18 -
          competition * 0.12,
        -1,
        1,
      ),
    ),
    economicImpact: round(
      clamp(
        establishment *
          (analysis.traits.size + analysis.traits.nightLuminosity) *
          0.18,
        -1,
        1,
      ),
    ),
    waterImpact: round(clamp(-waterCost * 0.3, -1, 0)),
    populationImpact: round(
      clamp(establishment * 0.08 - Math.max(0, waterCost - 0.7) * 0.14, -1, 1),
    ),
    uncertainty: round(
      clamp(0.12 + timeScale * 0.16 + (1 - suitability) * 0.25),
    ),
    factors: [
      `habitat_suitability:${suitability}`,
      `water_need:${analysis.traits.waterNeed}`,
      `adaptability:${analysis.traits.adaptability}`,
      `seed_variation:${round(stochasticVariation)}`,
    ],
  };
}

export function previewContribution(
  seed: string,
  analysis: ContributionAnalysis,
  region: PlanetRegion,
  simulationRuns = 64,
): ContributionPreview {
  if (!analysis.moderation.accepted)
    throw new Error("CONTRIBUTION_REJECTED_BY_MODERATION");
  const horizons = [1, 10, 100, 1000] as const;
  const allRuns = horizons.flatMap((horizonYears) =>
    Array.from({ length: simulationRuns }, (_, run) =>
      simulateOutcome(
        analysis,
        region,
        horizonYears,
        new SeededRandom(
          hashSeed(
            `${seed}:${analysis.name}:${region.id}:${horizonYears}:${run}`,
          ),
        ),
      ),
    ),
  );

  const averageFor = (
    horizonYears: ScenarioOutcome["horizonYears"],
  ): ScenarioOutcome => {
    const matches = allRuns.filter(
      (outcome) => outcome.horizonYears === horizonYears,
    );
    const average = (
      key: keyof Pick<
        ScenarioOutcome,
        | "successProbability"
        | "environmentalImpact"
        | "economicImpact"
        | "waterImpact"
        | "populationImpact"
        | "uncertainty"
      >,
    ) =>
      round(
        matches.reduce((sum, outcome) => sum + outcome[key], 0) /
          matches.length,
      );
    return {
      horizonYears,
      successProbability: average("successProbability"),
      environmentalImpact: average("environmentalImpact"),
      economicImpact: average("economicImpact"),
      waterImpact: average("waterImpact"),
      populationImpact: average("populationImpact"),
      uncertainty: average("uncertainty"),
      factors: matches[0]?.factors ?? [],
    };
  };
  const scenarios = horizons.map(averageFor);
  const centuryRuns = allRuns
    .filter((outcome) => outcome.horizonYears === 100)
    .sort(
      (a, b) =>
        a.environmentalImpact +
        a.economicImpact +
        a.populationImpact -
        (b.environmentalImpact + b.economicImpact + b.populationImpact),
    );

  return {
    analysis,
    regionId: region.id,
    habitatSuitability: habitatSuitability(analysis, region),
    scenarios,
    worstScenario: centuryRuns[0]!,
    likelyScenario: centuryRuns[Math.floor(centuryRuns.length / 2)]!,
    bestScenario: centuryRuns[centuryRuns.length - 1]!,
    simulationRuns,
  };
}
