import type { BiomeType, ContributionCategory, ContributionTraits, ParsedContribution } from "@kawkab/shared-types";
import { approxTokens, estimateCost, type AiProvider, type AiUsage, type JsonCompletionRequest, type JsonCompletionResult, type TextCompletionResult } from "../types.js";

/**
 * Deterministic offline provider. It parses Arabic & English keyword signals
 * into normalised traits — real parsing, not random fabrication — and clearly
 * flags every response as sandbox output.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "mock";
  readonly sandbox = true;

  async completeJson(req: JsonCompletionRequest): Promise<JsonCompletionResult> {
    const started = Date.now();
    let json: unknown;
    if (req.operation === "parse_contribution") {
      json = parseContributionText(req.prompt, extractHintCategory(req.system));
    } else if (req.operation === "moderate") {
      json = { status: "approved", score: 0.05, reasons: [] };
    } else {
      json = { text: "" };
    }
    const raw = JSON.stringify(json);
    return {
      raw,
      json,
      usage: this.usage(req, started, raw),
    };
  }

  async completeText(req: JsonCompletionRequest): Promise<TextCompletionResult> {
    const started = Date.now();
    return { text: "", usage: this.usage(req, started, "") };
  }

  private usage(req: JsonCompletionRequest, started: number, out: string): AiUsage {
    const tokensIn = approxTokens(req.system + req.prompt);
    const tokensOut = approxTokens(out);
    return {
      provider: this.name,
      model: this.model,
      operation: req.operation,
      tokensIn,
      tokensOut,
      costUsd: estimateCost(this.model, tokensIn, tokensOut),
      latencyMs: Date.now() - started,
      sandbox: true,
    };
  }
}

function extractHintCategory(system: string): ContributionCategory | undefined {
  const m = system.match(/category=([a-z_]+)/);
  return m ? (m[1] as ContributionCategory) : undefined;
}

interface Signal {
  patterns: RegExp[];
  trait: keyof ContributionTraits;
  value: number;
}

const TRAIT_SIGNALS: Signal[] = [
  { patterns: [/(?:ي|ت|ن)?متص\s+التلوث|ينقي\s+الهواء|pollution|absorbs?\s+pollution/i], trait: "pollutionAbsorption", value: 0.9 },
  { patterns: [/تضيء|مضيئة|متوهج|ضياء|glow|luminous|shines?|light[- ]up/i], trait: "luminosity", value: 0.8 },
  { patterns: [/عملاق|ضخم|هائل|giant|huge|colossal|massive/i], trait: "size", value: 0.9 },
  { patterns: [/صغير|دقيق|tiny|small|micro/i], trait: "size", value: 0.15 },
  { patterns: [/سريع\s+النمو|ينمو\s+بسرعة|fast[- ]growing|grows?\s+fast/i], trait: "growthRate", value: 0.8 },
  { patterns: [/بطيء\s+النمو|slow[- ]growing/i], trait: "growthRate", value: 0.2 },
  { patterns: [/ماء|المياه|الأنهار|water|rivers?/i], trait: "waterNeed", value: 0.7 },
  { patterns: [/يخزن\s+(الطاقة|الشمس)|طاقة\s+شمسية|stores?\s+(energy|sunlight)|solar/i], trait: "energyStorage", value: 0.85 },
  { patterns: [/ينتج\s+طاقة|يولد\s+طاقة|generates?\s+(energy|power)|power\s+source/i], trait: "energyOutput", value: 0.8 },
  { patterns: [/حرارة|الصحراء|heat|desert/i], trait: "heatResistance", value: 0.75 },
  { patterns: [/برد|جليد|قطبي|cold|frost|arctic|ice/i], trait: "coldResistance", value: 0.75 },
  { patterns: [/سام|سُم|toxic|poison/i], trait: "toxicity", value: 0.6 },
  { patterns: [/ينتشر\s+بسرعة|سريع\s+الانتشار|spreads?\s+(fast|quickly)|invasive/i], trait: "spreadRate", value: 0.75 },
  { patterns: [/ذكي|عاقل|intelligent|smart|clever/i], trait: "intelligence", value: 0.7 },
  { patterns: [/مفترس|شرس|عدواني|predator|aggressive|fierce/i], trait: "aggression", value: 0.7 },
  { patterns: [/يطير|يسبح|طيران|سباحة|flies|swims|fast\s+mover/i], trait: "mobility", value: 0.75 },
  { patterns: [/يتكيف|متكيف|adaptable|adapt/i], trait: "adaptability", value: 0.7 },
  { patterns: [/يتكاثر\s+بسرعة|breeds?\s+fast|prolific/i], trait: "reproductionRate", value: 0.75 },
  { patterns: [/معدي|ينتقل|contagious|infectious/i], trait: "contagiousness", value: 0.65 },
  { patterns: [/قاتل|مميت|lethal|deadly|fatal/i], trait: "lethality", value: 0.6 },
  { patterns: [/نادر|rare|scarce/i], trait: "scarcity", value: 0.8 },
  { patterns: [/ثمين|قيّم|ذهب|valuable|precious|gold/i], trait: "value", value: 0.75 },
  { patterns: [/متجدد|renewable/i], trait: "renewalRate", value: 0.7 },
  { patterns: [/ملهم|إلهام|inspir/i], trait: "influence", value: 0.7 },
  { patterns: [/سلام|peace/i], trait: "warProbabilityMultiplier", value: 0.5 },
  { patterns: [/عمر\s+طويل|long[- ]lived|immortal|خالد/i], trait: "lifespan", value: 0.85 },
];

const CATEGORY_SIGNALS: Array<[RegExp, ContributionCategory]> = [
  [/شجرة|نبات|زهرة|عشب|غابة|tree|plant|flower|forest|kelp/i, "plant"],
  [/مخلوق|حيوان|وحش|طائر|سمك|creature|animal|beast|bird|fish|insect/i, "creature"],
  [/معدن|مورد|كنز|نفط|ذهب|mineral|resource|oil|gold|crystal|ore/i, "resource"],
  [/حضارة|شعب|قبيلة|أمة|مملكة|civilization|tribe|kingdom|people|nation/i, "civilization"],
  [/اختراع|تقنية|جهاز|آلة|invention|technology|device|machine|engine/i, "invention"],
  [/مرض|وباء|طاعون|disease|plague|fever|virus/i, "disease"],
  [/ثقافة|فن|موسيقى|لغة|culture|art|music|language/i, "culture"],
  [/قانون|سلام\s+عالمي|law|treaty/i, "world_law"],
  [/إعصار|ظاهرة|عاصفة|شفق|phenomenon|storm|aurora|hurricane/i, "natural_phenomenon"],
];

const BIOME_SIGNALS: Array<[RegExp, BiomeType]> = [
  [/استوائي|مطير|tropical|rainforest/i, "rainforest"],
  [/معتدل|temperate/i, "temperate_forest"],
  [/صحراء|desert/i, "desert"],
  [/جبل|جبال|mountain/i, "mountains"],
  [/محيط|بحر|ocean|sea/i, "ocean"],
  [/سهل|سهول|plain/i, "plains"],
  [/تندرا|tundra/i, "tundra"],
  [/مستنقع|swamp/i, "swamp"],
  [/سهوب|steppe/i, "steppe"],
  [/بركان|volcan/i, "volcanic"],
  [/جليد|قطب|ice|polar/i, "ice"],
];

const RISK_BY_TRAIT: Record<string, string> = {
  waterNeed: "high_water_consumption",
  spreadRate: "invasive_spread",
  reproductionRate: "overpopulation",
  aggression: "predation_pressure",
  toxicity: "poisoning_risk",
  energyOutput: "resource_rush_conflicts",
  energyStorage: "energy_monopoly_risk",
  pollutionAbsorption: "ecosystem_competition",
  contagiousness: "pandemic_risk",
  size: "habitat_strain",
};

export function parseContributionText(text: string, hintCategory?: ContributionCategory): ParsedContribution {
  const traits: ContributionTraits = {};
  for (const signal of TRAIT_SIGNALS) {
    if (signal.patterns.some((p) => p.test(text))) {
      // later signals for the same trait only refine, never exceed caps
      traits[signal.trait] = signal.value;
    }
  }
  if (Object.keys(traits).length === 0) {
    // neutral default: a modest, simulatable element
    traits["adaptability"] = 0.5;
    traits["size"] = 0.4;
  }

  let category = hintCategory;
  if (!category) {
    for (const [pattern, cat] of CATEGORY_SIGNALS) {
      if (pattern.test(text)) {
        category = cat;
        break;
      }
    }
  }
  category ??= "custom";

  // domain inference: giant flora drinks heavily; glowing flora stores energy
  if (category === "plant") {
    if ((traits["size"] ?? 0) >= 0.8 && (traits["waterNeed"] ?? 0) < 0.7) traits["waterNeed"] = 0.7;
    if ((traits["luminosity"] ?? 0) >= 0.5 && (traits["energyStorage"] ?? 0) < 0.5) traits["energyStorage"] = 0.5;
    if (traits["growthRate"] === undefined) traits["growthRate"] = 0.4;
    if (traits["spreadRate"] === undefined) traits["spreadRate"] = 0.4;
  }

  const biomes = new Set<BiomeType>();
  for (const [pattern, biome] of BIOME_SIGNALS) {
    if (pattern.test(text)) biomes.add(biome);
  }
  if (biomes.size === 0 && category === "plant") {
    biomes.add("temperate_forest");
    biomes.add("rainforest");
  }

  const name = extractName(text) ?? defaultName(category, traits);

  const risks: string[] = [];
  for (const [trait, risk] of Object.entries(RISK_BY_TRAIT)) {
    const v = traits[trait];
    if (v !== undefined && v >= 0.65 && !trait.endsWith("Multiplier")) risks.push(risk);
  }
  const benefits: string[] = [];
  if ((traits["pollutionAbsorption"] ?? 0) > 0.4) benefits.push("pollution_reduction");
  if ((traits["energyStorage"] ?? 0) > 0.4 || (traits["energyOutput"] ?? 0) > 0.4) benefits.push("energy_supply");
  if ((traits["luminosity"] ?? 0) > 0.4) benefits.push("night_illumination");
  if ((traits["value"] ?? 0) > 0.5) benefits.push("economic_value");

  return {
    category,
    name,
    description: text.slice(0, 500),
    traits,
    possibleBiomes: [...biomes],
    risks,
    benefits,
  };
}

function extractName(text: string): string | null {
  const patterns = [
    /اسم(?:ها|ه)?\s*[:«"]?\s*([^\s.,»"]+(?:\s+[^\s.,»"]+){0,3})/,
    /(?:called|named)\s+["']?([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*){0,3})/i,
    /[«"]([^»"]{2,40})[»"]/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function defaultName(category: ContributionCategory, traits: ContributionTraits): string {
  const glowing = (traits["luminosity"] ?? 0) > 0.4;
  const giant = (traits["size"] ?? 0) > 0.7;
  switch (category) {
    case "plant": return glowing ? "شجرة الضوء" : giant ? "النبات العملاق" : "نبات جديد";
    case "creature": return giant ? "المخلوق العملاق" : "مخلوق جديد";
    case "resource": return "مورد جديد";
    case "civilization": return "شعب جديد";
    case "invention": return "اختراع جديد";
    case "disease": return "مرض جديد";
    case "culture": return "ثقافة جديدة";
    case "world_law": return "قانون جديد";
    case "natural_phenomenon": return "ظاهرة جديدة";
    default: return "عنصر جديد";
  }
}
