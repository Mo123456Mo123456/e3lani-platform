/**
 * Sandbox contribution analyzer — the offline "mock provider".
 *
 * A deterministic heuristic parser (Arabic + English) that turns free text
 * into a StructuredContribution. It is deliberately labeled provider:"mock":
 * in production with AI keys configured, the external orchestrator
 * (services/ai-orchestrator, FastAPI) performs this step with a real LLM.
 * The output schema is identical either way.
 */
import type {
  Biome,
  ContributionCategory,
  Locale,
  StructuredContribution,
} from "@planet/shared-types";
import { structuredContributionSchema } from "@planet/validation";
import { hashString } from "@planet/simulation-models";

interface Rule {
  pattern: RegExp;
  apply(traits: Record<string, number>): void;
  biome?: Biome;
  risk?: string;
}

const CATEGORY_PATTERNS: Array<[RegExp, ContributionCategory]> = [
  [/شجر|نبات|زهرة|عشب|غابة|plant|tree|flower|forest|crop/i, "plant"],
  [/مخلوق|كائن|حيوان|وحش|طائر|سمكة|creature|animal|beast|bird/i, "creature"],
  [/حضارة|إمبراطورية|مملكة|قبيلة|شعب|civilization|empire|kingdom|tribe/i, "civilization"],
  [/اختراع|جهاز|آلة|تقنية|تكنولوجيا|invention|device|machine|technology/i, "invention"],
  [/مورد|ذهب|حديد|نفط|فحم|معدن|كريستال|resource|gold|iron|oil|coal|crystal|mineral/i, "resource"],
  [/مرض|وباء|طاعون|فيروس|disease|plague|virus|pandemic/i, "disease"],
  [/بركان|عاصفة|زلزال|ظاهرة|مناخ|volcano|storm|earthquake|phenomenon|climate/i, "phenomenon"],
  [/ثقافة|عادة|تقليد|فن|موسيقى|culture|tradition|art|music/i, "culture"],
  [/قانون|دستور|حكم|law|constitution|edict/i, "law"],
];

const TRAIT_RULES: Rule[] = [
  { pattern: /عملاق|ضخم|كبير|giant|huge|massive|colossal/i, apply: (t) => bump(t, "size", 0.35) },
  { pattern: /صغير|دقيق|tiny|small|micro/i, apply: (t) => bump(t, "size", -0.2) },
  { pattern: /سريع الانتشار|ينتشر|يتكاثر|fast.spread|spreads|multiplies|reproduc/i, apply: (t) => { bump(t, "growthRate", 0.3); bump(t, "reproductionRate", 0.3); } },
  { pattern: /بطيء|slow/i, apply: (t) => { bump(t, "growthRate", -0.2); bump(t, "reproductionRate", -0.2); } },
  { pattern: /التلوث|ينقي الهواء|pollution|absorb/i, apply: (t) => set(t, "pollutionAbsorption", 0.85) },
  { pattern: /تضيء|مضيء|متوهج|ضوء|glow|luminous|light/i, apply: (t) => set(t, "nightLuminosity", 0.7) },
  { pattern: /تخزن الطاقة|طاقة شمسية|طاقة|energy|solar/i, apply: (t) => set(t, "energyStorage", 0.7) },
  { pattern: /مقاوم للحر|يتحمل الحر|heat.resist|heat.tolerant/i, apply: (t) => set(t, "heatResistance", 0.8) },
  { pattern: /مقاوم للبرد|يتحمل البرد|cold.resist|cold.tolerant|frost/i, apply: (t) => set(t, "coldResistance", 0.8) },
  { pattern: /عطش|مياه كثيرة| thirsty|water/i, apply: (t) => bump(t, "waterNeed", 0.3), risk: "high_water_consumption" },
  { pattern: /سام|سامة|قاتل|toxic|poison|venom|lethal/i, apply: (t) => set(t, "toxicity", 0.7), risk: "ecosystem_poisoning" },
  { pattern: /ذكي|عاقل|intelligent|smart|sentient/i, apply: (t) => set(t, "intelligence", 0.7) },
  { pattern: /عدواني|مفترس|شرس|aggressive|predator|fierce/i, apply: (t) => set(t, "aggression", 0.75), risk: "predation_pressure" },
  { pattern: /مسالم|لطيف|peaceful|gentle/i, apply: (t) => set(t, "aggression", 0.1) },
  { pattern: /طويل العمر|يعيش طويلاً|long.lived|immortal/i, apply: (t) => set(t, "lifespan", 0.85) },
  { pattern: /طائر|يطير|fly|flying|winged/i, apply: (t) => set(t, "mobility", 0.85) },
  { pattern: /شديد العدوى|معدي|contagious|infectious/i, apply: (t) => set(t, "contagiousness", 0.8) },
  { pattern: /خصب|غلال|محصول|fertile|yield|harvest/i, apply: (t) => set(t, "yield", 0.75) },
  { pattern: /نادر|rare|scarce/i, apply: (t) => set(t, "rarity", 0.8) },
  { pattern: /قيّم|ثمين|valuable|precious/i, apply: (t) => set(t, "value", 0.8) },
];

const BIOME_PATTERNS: Array<[RegExp, Biome]> = [
  [/صحراء|رمال|desert|sand/i, "desert"],
  [/غابة مطيرة|استوائي|rainforest|tropical|jungle/i, "rainforest"],
  [/غابة|forest|woods/i, "temperate_forest"],
  [/محيط|بحر|ماء|ocean|sea|marine|aquatic/i, "ocean"],
  [/ساحل|شاطئ|coast|shore/i, "coast"],
  [/جبل|جبال|mountain/i, "mountains"],
  [/تندرا|قطبي|جليد|tundra|arctic|ice|frozen/i, "tundra"],
  [/سهول|مرج|plain|meadow|grassland/i, "plains"],
  [/مستنقع|swamp|marsh|wetland/i, "swamp"],
  [/بركان|volcan/i, "volcanic"],
  [/سهب|ستيب|steppe/i, "steppe"],
];

const CATEGORY_DEFAULT_BIOMES: Record<ContributionCategory, Biome[]> = {
  plant: ["plains", "temperate_forest"],
  creature: ["plains", "temperate_forest"],
  resource: ["mountains"],
  civilization: ["plains"],
  invention: ["plains"],
  phenomenon: ["plains"],
  disease: ["plains"],
  culture: ["plains"],
  law: ["plains"],
  custom: ["plains"],
};

function bump(traits: Record<string, number>, key: string, delta: number): void {
  traits[key] = Math.round(Math.min(1, Math.max(0, (traits[key] ?? 0.4) + delta)) * 1000) / 1000;
}
function set(traits: Record<string, number>, key: string, value: number): void {
  traits[key] = Math.max(traits[key] ?? 0, value);
}

export interface AnalysisResult {
  structured: StructuredContribution;
  provider: "mock";
}

export function analyzeText(
  text: string,
  hint: ContributionCategory | undefined,
  locale: Locale,
): AnalysisResult {
  const traits: Record<string, number> = {};
  const biomes = new Set<Biome>();
  const risks = new Set<string>();

  let category: ContributionCategory = hint ?? "custom";
  if (!hint) {
    for (const [pattern, cat] of CATEGORY_PATTERNS) {
      if (pattern.test(text)) {
        category = cat;
        break;
      }
    }
  }

  for (const rule of TRAIT_RULES) {
    if (rule.pattern.test(text)) {
      rule.apply(traits);
      if (rule.risk) risks.add(rule.risk);
    }
  }
  for (const [pattern, biome] of BIOME_PATTERNS) {
    if (pattern.test(text)) biomes.add(biome);
  }

  // baseline traits per category so every addition is simulatable
  const baseline = baselineTraits(category);
  for (const [key, value] of Object.entries(baseline)) {
    if (!(key in traits)) traits[key] = value;
  }

  // deterministic jitter so identical text always yields identical output
  const jitterSeed = hashString(text);
  for (const key of Object.keys(traits)) {
    const j = ((jitterSeed % 100) - 50) / 2500;
    traits[key] = Math.round(Math.min(0.95, Math.max(0.05, traits[key]! + j)) * 1000) / 1000;
  }

  if ((traits.waterNeed ?? 0) > 0.6) risks.add("high_water_consumption");
  if ((traits.energyStorage ?? 0) > 0.65) risks.add("future_resource_conflicts");
  if ((traits.toxicity ?? 0) > 0.5) risks.add("food_web_disruption");
  if ((traits.reproductionRate ?? 0) > 0.7) risks.add("overpopulation_pressure");

  const name = extractName(text, category, locale);
  const structured = structuredContributionSchema.parse({
    category,
    name,
    description: text.slice(0, 600),
    traits,
    possibleBiomes: biomes.size > 0 ? [...biomes] : CATEGORY_DEFAULT_BIOMES[category],
    risks: [...risks].slice(0, 6),
  });
  return { structured, provider: "mock" };
}

function baselineTraits(category: ContributionCategory): Record<string, number> {
  switch (category) {
    case "plant":
      return { size: 0.4, growthRate: 0.35, waterNeed: 0.5, pollutionAbsorption: 0.3, coldResistance: 0.4, heatResistance: 0.4 };
    case "creature":
      return { size: 0.4, reproductionRate: 0.4, waterNeed: 0.5, aggression: 0.3, mobility: 0.4, adaptability: 0.4, mutationRate: 0.2, intelligence: 0.2 };
    case "resource":
      return { yield: 0.5, value: 0.6, rarity: 0.4 };
    case "civilization":
      return { intelligence: 0.5, aggression: 0.3, adaptability: 0.5 };
    case "invention":
      return { efficiency: 0.4, yield: 0.3, energyStorage: 0.3 };
    case "disease":
      return { severity: 0.4, contagiousness: 0.4 };
    case "phenomenon":
      return { severity: 0.4, warming: 0.1, wetness: 0.1 };
    default:
      return { adaptability: 0.4, intelligence: 0.3 };
  }
}

function extractName(text: string, category: ContributionCategory, locale: Locale): string {
  const quoted = text.match(/[«"“]([^»"”]{2,60})[»"”]/);
  if (quoted) return quoted[1]!.trim();
  const named = text.match(/(?:اسم(?:ه|ها)?\s+|called\s+|named\s+)([\p{L}][\p{L}\s-]{1,40})/u);
  if (named) return named[1]!.trim().split(/\s+/).slice(0, 4).join(" ");
  const first = text.trim().split(/\s+/).slice(0, 3).join(" ");
  const fallback: Record<ContributionCategory, [string, string]> = {
    plant: ["نبتة", "plant"],
    creature: ["مخلوق", "creature"],
    resource: ["مورد", "resource"],
    civilization: ["حضارة", "civilization"],
    invention: ["اختراع", "invention"],
    phenomenon: ["ظاهرة", "phenomenon"],
    disease: ["وباء", "disease"],
    culture: ["ثقافة", "culture"],
    law: ["قانون", "law"],
    custom: ["عنصر", "element"],
  };
  const [ar, en] = fallback[category];
  const label = locale === "ar" ? ar : en;
  return first.length >= 4 ? first : `${label} ${text.length % 97}`;
}
