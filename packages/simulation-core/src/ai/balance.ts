import type { BiomeType, ElementCategory, StructuredElement } from "@planet/shared-types";

const OVERPOWERED_PATTERNS = [
  /لا\s*يموت|immortal|invincible|god\s*mode/i,
  /غير\s*محدود|unlimited|infinite\s*(energy|power|population)/i,
  /يدمر\s*(الكوكب|العالم)|destroy\s*(planet|world)/i,
  /سيطرة\s*مطلقة|absolute\s*control|omnipotent/i,
  /يلغي\s*جميع\s*القوانين|ignore\s*all\s*laws/i,
];

const CATEGORY_KEYWORDS: { cat: ElementCategory; ar: RegExp; en: RegExp }[] = [
  { cat: "plant", ar: /نبات|شجر|غابة|زهرة/, en: /plant|tree|forest|flora|flower/ },
  { cat: "creature", ar: /مخلوق|حيوان|كائن|طائر|سمكة/, en: /creature|animal|beast|bird|fish|species/ },
  { cat: "civilization", ar: /حضارة|مملكة|قبيلة|أمة/, en: /civilization|kingdom|tribe|nation|empire/ },
  { cat: "resource", ar: /مورد|معدن|حديد|ذهب|نفط/, en: /resource|metal|iron|gold|oil|ore/ },
  { cat: "invention", ar: /اختراع|آلة|جهاز/, en: /invention|machine|device|gadget/ },
  { cat: "technology", ar: /تقنية|تكنولوجيا/, en: /technology|tech|engineering/ },
  { cat: "disease", ar: /مرض|وباء|فيروس/, en: /disease|plague|virus|pathogen/ },
  { cat: "disaster", ar: /كارثة|بركان|زلزال|إعصار/, en: /disaster|volcano|earthquake|hurricane/ },
  { cat: "climate_phenomenon", ar: /مناخ|عاصفة|مطر|جفاف/, en: /climate|storm|rain|drought|weather/ },
  { cat: "energy_source", ar: /طاقة|شمس|نووي/, en: /energy|solar|nuclear|power\s*source/ },
  { cat: "culture", ar: /ثقافة|فن|موسيقى/, en: /culture|art|music|tradition/ },
  { cat: "alliance", ar: /تحالف|معاهدة/, en: /alliance|treaty|pact/ },
];

export function analyzeContributionHeuristic(
  text: string,
  preferredCategory?: ElementCategory,
): StructuredElement {
  const lower = text.toLowerCase();
  let category: ElementCategory = preferredCategory ?? "custom";
  if (!preferredCategory) {
    for (const k of CATEGORY_KEYWORDS) {
      if (k.ar.test(text) || k.en.test(lower)) {
        category = k.cat;
        break;
      }
    }
  }

  const traits: Record<string, number> = {
    size: clamp01(score(lower, [/عملاق|giant|huge|massive/], [/صغير|tiny|small/], 0.5)),
    growthRate: clamp01(score(lower, [/سريع|fast|rapid|growth/], [/بطيء|slow/], 0.4)),
    waterNeed: clamp01(score(lower, [/ماء|water|river|ocean/], [/صحراء|desert|dry/], 0.5)),
    pollutionAbsorption: clamp01(
      score(lower, [/تلوث|pollution|clean|تنقية|يمتص|تمتص/], [], 0.1),
    ),
    nightLuminosity: clamp01(score(lower, [/يضيء|light|glow|ليل|night/], [], 0.05)),
    coldResistance: clamp01(score(lower, [/برد|cold|ice|ثلج/], [/حر|heat|fire/], 0.4)),
    heatResistance: clamp01(score(lower, [/حر|heat|fire|شمس|sun/], [/برد|cold/], 0.4)),
    intelligence: clamp01(score(lower, [/ذكي|smart|intelligent|علم/], [], 0.3)),
    aggression: clamp01(score(lower, [/عدوان|حرب|war|aggressive|مفترس|predator/], [/سلمي|peaceful/], 0.3)),
    reproduction: clamp01(score(lower, [/تكاثر|breed|reproduce|سريع النمو/], [], 0.4)),
    adaptability: clamp01(score(lower, [/تكيف|adapt/], [], 0.5)),
  };

  const possibleBiomes = inferBiomes(text, category, traits);
  const risks: string[] = [];
  const benefits: string[] = [];

  if (traits.waterNeed > 0.7) risks.push("high_water_consumption");
  if (traits.aggression > 0.7) risks.push("conflict_escalation");
  if (traits.reproduction > 0.85) risks.push("ecosystem_competition");
  if (traits.pollutionAbsorption > 0.5) benefits.push("pollution_reduction");
  if (traits.nightLuminosity > 0.4) benefits.push("night_illumination");
  if (category === "plant") benefits.push("habitat_support");
  if (category === "energy_source") benefits.push("energy_supply");

  const name = extractName(text, category);
  const balanced = balanceElement({
    category,
    name,
    nameAr: name,
    description: text.slice(0, 500),
    traits,
    possibleBiomes,
    risks,
    benefits,
    balanced: true,
    balanceNotes: [],
  });

  return balanced;
}

export function balanceElement(element: StructuredElement): StructuredElement {
  const notes: string[] = [];
  const traits = { ...element.traits };
  let balanced = true;

  const textBlob = `${element.name} ${element.description ?? ""} ${element.risks.join(" ")}`;
  for (const p of OVERPOWERED_PATTERNS) {
    if (p.test(textBlob)) {
      balanced = false;
      notes.push("overpowered_pattern_detected");
    }
  }

  if ((traits.reproduction ?? 0) > 0.9) {
    traits.reproduction = 0.7;
    notes.push("capped_reproduction_to_0.7");
    balanced = false;
  }
  if ((traits.size ?? 0) >= 1 && (traits.aggression ?? 0) >= 0.95) {
    traits.aggression = 0.6;
    traits.size = 0.85;
    notes.push("capped_apex_predator_traits");
    balanced = false;
  }
  // No immortal — force mortality via missing immortality trait
  if ("immortality" in traits || "deathRate" in traits && traits.deathRate === 0) {
    traits.deathRate = 0.15;
    delete traits.immortality;
    notes.push("removed_immortality");
    balanced = false;
  }
  if ((traits.energyOutput ?? 0) > 0.95 && (traits.waterNeed ?? 1) < 0.1) {
    traits.energyOutput = 0.7;
    traits.waterNeed = 0.4;
    notes.push("balanced_energy_requires_resources");
    balanced = false;
  }

  const balanceScore = clamp01(
    1 -
      notes.length * 0.15 -
      Math.max(0, (traits.reproduction ?? 0) - 0.7) -
      Math.max(0, (traits.aggression ?? 0) - 0.8) * 0.5,
  );

  return {
    ...element,
    traits,
    balanced: notes.length === 0 ? element.balanced : false,
    balanceNotes: [...element.balanceNotes, ...notes],
    balanceScore,
    risks: Array.from(new Set([...element.risks, ...notes.filter((n) => n.includes("capped") || n.includes("overpowered"))])),
  };
}

function inferBiomes(
  text: string,
  category: ElementCategory,
  traits: Record<string, number>,
): BiomeType[] {
  const biomes: BiomeType[] = [];
  if (/غابة|forest|jungle|شجر|tree/.test(text)) {
    biomes.push("rainforest", "temperate_forest");
  }
  if (/صحراء|desert|رمل/.test(text)) biomes.push("desert");
  if (/جبل|mountain|قمة/.test(text)) biomes.push("mountain");
  if (/ساحل|coast|بحر|ocean|محيط/.test(text)) biomes.push("coast", "ocean");
  if (/قطب|ice|ثلج|tundra/.test(text)) biomes.push("tundra", "ice");
  if (/سهل|plain|مراعي/.test(text)) biomes.push("plains", "steppe");
  if (biomes.length === 0) {
    if (category === "plant") {
      if ((traits.waterNeed ?? 0.5) > 0.6) biomes.push("rainforest", "temperate_forest");
      else biomes.push("plains", "steppe");
    } else if (category === "creature") {
      biomes.push("plains", "temperate_forest", "coast");
    } else {
      biomes.push("plains", "coast", "temperate_forest");
    }
  }
  return Array.from(new Set(biomes));
}

function extractName(text: string, category: ElementCategory): string {
  const quoted = text.match(/[«"]([^»"]+)[»"]/);
  if (quoted?.[1]) return quoted[1].slice(0, 80);
  const first = text.split(/[.。\n،,]/)[0]?.trim() ?? "";
  if (first.length > 3 && first.length < 80) return first.replace(/^أريد إضافة\s*/i, "").replace(/^i want to add\s*/i, "");
  const defaults: Record<string, string> = {
    plant: "نبات جديد",
    creature: "مخلوق جديد",
    civilization: "حضارة جديدة",
    resource: "مورد جديد",
  };
  return defaults[category] ?? "عنصر جديد";
}

function score(
  text: string,
  positive: RegExp[],
  negative: RegExp[],
  base: number,
): number {
  let s = base;
  for (const p of positive) if (p.test(text)) s += 0.25;
  for (const n of negative) if (n.test(text)) s -= 0.25;
  return s;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
