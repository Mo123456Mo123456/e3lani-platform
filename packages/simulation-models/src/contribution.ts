import type {
  BiomeType,
  ContributionCategory,
  ImpactPreview,
  StructuredContribution,
} from "@planet/shared-types";
import { biomeSuitability } from "./biomes.js";
import { SeededRandom } from "./rng.js";
import type { SimEvent, WorldState } from "./world-state.js";
import { cloneWorld } from "./world-state.js";

const HARD_CAPS: Record<string, number> = {
  size: 1,
  growthRate: 0.85,
  waterNeed: 1,
  reproduction: 0.7,
  pollutionAbsorption: 0.95,
  energyOutput: 0.85,
  lethality: 0.7,
  contagiousness: 0.8,
  militaryPower: 0.9,
  adaptability: 0.95,
};

const FORBIDDEN_PATTERNS = [
  /immortal|لا\s*يموت|أبدي|godmode|infinite\s*energy|طاقة\s*لا\s*نهائية|destroy\s*planet|دمّر\s*الكوكب|تحكم\s*مطلق/i,
];

export function balanceContribution(input: StructuredContribution): StructuredContribution {
  const traits = { ...input.traits };
  const balanceNotes = [...input.balanceNotes];
  let wasBalanced = input.wasBalanced;

  for (const [key, max] of Object.entries(HARD_CAPS)) {
    const val = traits[key];
    if (typeof val === "number" && val > max) {
      traits[key] = max;
      wasBalanced = true;
      balanceNotes.push(`Capped ${key} to ${max}`);
    }
  }

  // Soft dependency: high energy needs water/heat tradeoffs
  if ((traits.energyOutput ?? 0) > 0.6 && (traits.waterNeed ?? 0) < 0.4) {
    traits.waterNeed = 0.55;
    wasBalanced = true;
    balanceNotes.push("High energy output requires higher water need");
  }
  if ((traits.pollutionAbsorption ?? 0) > 0.7 && (traits.growthRate ?? 0) > 0.6) {
    traits.growthRate = 0.45;
    wasBalanced = true;
    balanceNotes.push("Strong pollution absorption slowed growth for balance");
  }

  if (FORBIDDEN_PATTERNS.some((p) => p.test(input.originalIdea))) {
    wasBalanced = true;
    balanceNotes.push("Overpowered intent detected — traits normalized");
    for (const k of Object.keys(traits)) {
      const v = traits[k];
      if (typeof v === "number") traits[k] = Math.min(v, 0.7);
    }
  }

  return { ...input, traits, balanceNotes, wasBalanced };
}

export function previewImpact(
  state: WorldState,
  contrib: StructuredContribution,
  regionId: string,
): ImpactPreview {
  const region = state.regions.find((r) => r.id === regionId);
  const suitability = region
    ? biomeSuitability(region.biome, contrib.possibleBiomes)
    : 0;
  const waterOk = region ? 1 - Math.abs(region.water - (contrib.traits.waterNeed ?? 0.5)) : 0.3;
  const successProbability = clamp(suitability * 0.6 + waterOk * 0.3 + 0.1, 0.05, 0.98);

  const env =
    (contrib.traits.pollutionAbsorption ?? 0) * 0.5 -
    (contrib.traits.pollutionEmission ?? 0) -
    (contrib.traits.lethality ?? 0) * 0.3;
  const econ =
    (contrib.traits.economicValue ?? 0) +
    (contrib.traits.energyOutput ?? 0) * 0.5 -
    (contrib.traits.waterNeed ?? 0) * 0.2;

  const beneficiaries = state.civilizations
    .filter((c) => c.regionIds.includes(regionId) || suitability > 0.5)
    .slice(0, 3)
    .map((c) => c.nameAr);

  return {
    successProbability: round2(successProbability),
    suitableBiomes: contrib.possibleBiomes,
    environmentalImpact: round2(env),
    economicImpact: round2(econ),
    risks: contrib.risks,
    beneficiaryCivilizations: beneficiaries,
    shortTermEffects: buildShortTerm(contrib),
    longTermEffects: buildLongTerm(contrib),
  };
}

function buildShortTerm(c: StructuredContribution): string[] {
  const out: string[] = ["Local establishment in chosen region"];
  if (c.category === "plant") out.push("Initial vegetation coverage growth");
  if (c.category === "creature") out.push("Population settles near food sources");
  if (c.category === "resource") out.push("Scouts may detect the deposit");
  if (c.category === "disease") out.push("Localized infection risk rises");
  return out;
}

function buildLongTerm(c: StructuredContribution): string[] {
  const out: string[] = ["Causal ripple through ecosystems and societies"];
  if ((c.traits.energyOutput ?? 0) > 0.4) out.push("Energy economies may reorganize");
  if ((c.traits.pollutionAbsorption ?? 0) > 0.5) out.push("Pollution trends may improve regionally");
  if (c.risks.includes("ecosystem_competition")) out.push("Native species competition intensifies");
  return out;
}

export interface ApplyResult {
  state: WorldState;
  event: SimEvent;
  entityId: string;
  preview: ImpactPreview;
}

export function applyContribution(
  input: WorldState,
  contrib: StructuredContribution,
  regionId: string,
  userId: string,
  contributionId: string,
): ApplyResult {
  const state = cloneWorld(input);
  const balanced = balanceContribution(contrib);
  const preview = previewImpact(state, balanced, regionId);
  const rng = new SeededRandom(state.rngState ^ hashStr(contributionId));
  const region = state.regions.find((r) => r.id === regionId);
  if (!region || region.biome === "ocean") {
    throw new Error("Invalid region for contribution");
  }

  let entityId = "";
  const t = balanced.traits;

  switch (balanced.category) {
    case "plant": {
      entityId = `plt_user_${contributionId}`;
      state.plants.push({
        id: entityId,
        name: balanced.name,
        nameAr: balanced.nameAr,
        regionIds: [regionId],
        coverage: 0.15,
        growthRate: t.growthRate ?? 0.3,
        waterNeed: t.waterNeed ?? 0.5,
        pollutionAbsorption: t.pollutionAbsorption ?? 0.2,
        energyOutput: t.energyOutput ?? 0,
        nightLuminosity: t.nightLuminosity ?? 0,
        fertilityBoost: t.fertilityBoost ?? 0.1,
        contributionId,
      });
      break;
    }
    case "creature": {
      entityId = `spc_user_${contributionId}`;
      state.species.push({
        id: entityId,
        name: balanced.name,
        nameAr: balanced.nameAr,
        regionIds: [regionId],
        population: 200,
        size: t.size ?? 0.4,
        reproduction: Math.min(0.7, t.growthRate ?? 0.3),
        aggression: t.aggression ?? 0.3,
        intelligence: t.intelligence ?? 0.3,
        coldResistance: t.coldResistance ?? 0.4,
        heatResistance: t.heatResistance ?? 0.4,
        waterNeed: t.waterNeed ?? 0.5,
        foodNeed: t.foodNeed ?? 0.5,
        adaptability: t.adaptability ?? 0.5,
        mutationRate: t.mutationRate ?? 0.05,
        trophicLevel: 0.4,
        contributionId,
      });
      break;
    }
    case "resource":
    case "energy_source": {
      entityId = `res_user_${contributionId}`;
      state.resources.push({
        id: entityId,
        name: balanced.name,
        nameAr: balanced.nameAr,
        regionId,
        amount: 0.8,
        renewRate: t.growthRate ?? 0.02,
        extractRate: 0.03,
        value: t.economicValue ?? 0.6,
        environmentalImpact: t.pollutionEmission ?? 0.2,
        contributionId,
      });
      break;
    }
    case "civilization": {
      entityId = `civ_user_${contributionId}`;
      const cityId = `city_user_${contributionId}`;
      state.cities.push({
        id: cityId,
        name: `${balanced.name} Capital`,
        nameAr: `عاصمة ${balanced.nameAr}`,
        regionId,
        population: 20_000,
        civilizationId: entityId,
      });
      state.civilizations.push({
        id: entityId,
        name: balanced.name,
        nameAr: balanced.nameAr,
        regionIds: [regionId],
        capitalCityId: cityId,
        population: 20_000,
        techLevel: t.intelligence ?? 0.2,
        military: t.militaryPower ?? 0.2,
        economy: t.economicValue ?? 0.3,
        food: 0.6,
        health: 0.7,
        stability: 0.6,
        happiness: 0.55,
        education: t.intelligence ?? 0.3,
        pollution: t.pollutionEmission ?? 0.1,
        aggression: t.aggression ?? 0.3,
        innovation: t.adaptability ?? 0.4,
        culture: "emerging",
        language: `lang_user_${contributionId}`,
        government: "council",
        allies: [],
        enemies: [],
        memory: [],
        contributionId,
      });
      region.population += 20_000;
      break;
    }
    case "disease": {
      entityId = `dis_user_${contributionId}`;
      state.diseases.push({
        id: entityId,
        name: balanced.name,
        nameAr: balanced.nameAr,
        contagiousness: t.contagiousness ?? 0.3,
        lethality: t.lethality ?? 0.2,
        regionIds: [regionId],
        infected: 50,
        contributionId,
      });
      break;
    }
    case "invention":
    case "technology": {
      entityId = `tech_user_${contributionId}`;
      const civ = state.civilizations.find((c) => c.regionIds.includes(regionId));
      state.technologies.push({
        id: entityId,
        name: balanced.name,
        nameAr: balanced.nameAr,
        level: t.intelligence ?? 0.4,
        category: "science",
        discovererCivId: civ?.id,
        contributionId,
      });
      if (civ) civ.techLevel = clamp(civ.techLevel + 0.05, 0, 1);
      break;
    }
    case "disaster":
    case "climate_phenomenon": {
      entityId = `climate_user_${contributionId}`;
      region.temperature = clamp(region.temperature + (t.heatResistance ?? 0.2) * 0.1, 0, 1);
      region.pollution = clamp(region.pollution + (t.pollutionEmission ?? 0.2), 0, 1);
      break;
    }
    default: {
      entityId = `custom_user_${contributionId}`;
      // Custom elements become a mild plant-like ecological presence
      state.plants.push({
        id: entityId,
        name: balanced.name,
        nameAr: balanced.nameAr,
        regionIds: [regionId],
        coverage: 0.1,
        growthRate: t.growthRate ?? 0.2,
        waterNeed: t.waterNeed ?? 0.4,
        pollutionAbsorption: t.pollutionAbsorption ?? 0.1,
        energyOutput: t.energyOutput ?? 0,
        nightLuminosity: t.nightLuminosity ?? 0,
        fertilityBoost: t.fertilityBoost ?? 0.05,
        contributionId,
      });
    }
  }

  state.contributions.push({
    id: contributionId,
    userId,
    category: balanced.category,
    name: balanced.name,
    nameAr: balanced.nameAr,
    regionId,
    traits: Object.fromEntries(
      Object.entries(balanced.traits).filter(([, v]) => typeof v === "number"),
    ) as Record<string, number>,
    appliedTick: state.tick,
    entityId,
  });

  // Immediate local effects from success roll
  if (rng.next() < preview.successProbability) {
    region.fertility = clamp(region.fertility + (t.fertilityBoost ?? 0) * 0.05, 0, 1);
    region.pollution = clamp(
      region.pollution - (t.pollutionAbsorption ?? 0) * 0.05 + (t.pollutionEmission ?? 0) * 0.05,
      0,
      1,
    );
  }

  const event: SimEvent = {
    id: `evt_contrib_${contributionId}`,
    type: eventTypeFor(balanced.category),
    title: `${balanced.name} entered the world`,
    titleAr: `${balanced.nameAr} دخل العالم`,
    description: balanced.description,
    descriptionAr: balanced.descriptionAr,
    tick: state.tick,
    year: state.year,
    regionId,
    importance: 0.9,
    confidence: preview.successProbability,
    causes: ["user_contribution"],
    effects: preview.shortTermEffects,
    contributionId,
    actorIds: [entityId, userId],
    payload: {
      category: balanced.category,
      traits: balanced.traits,
      wasBalanced: balanced.wasBalanced,
    },
  };

  // Also emit CONTRIBUTION_APPLIED for causal anchoring
  const applied: SimEvent = {
    ...event,
    id: `evt_applied_${contributionId}`,
    type: "CONTRIBUTION_APPLIED",
    title: `Contribution applied: ${balanced.name}`,
    titleAr: `طُبّقت المساهمة: ${balanced.nameAr}`,
  };

  state.events.push(applied, event);
  state.rngState = rng.getState();

  return { state, event: applied, entityId, preview };
}

function eventTypeFor(category: ContributionCategory): SimEvent["type"] {
  switch (category) {
    case "plant":
      return "PLANT_CREATED";
    case "creature":
      return "SPECIES_CREATED";
    case "civilization":
      return "CIVILIZATION_FOUNDED";
    case "city":
      return "CITY_CREATED";
    case "invention":
    case "technology":
      return "TECHNOLOGY_DISCOVERED";
    case "disease":
      return "DISEASE_OUTBREAK";
    case "disaster":
      return "VOLCANO_ERUPTED";
    case "resource":
    case "energy_source":
      return "RESOURCE_DISCOVERED";
    case "alliance":
      return "ALLIANCE_CREATED";
    default:
      return "CONTRIBUTION_APPLIED";
  }
}

export function suggestBiomesFromText(text: string): BiomeType[] {
  const t = text.toLowerCase();
  const out: BiomeType[] = [];
  if (/غاب|forest|jungle|شجر/.test(t)) out.push("rainforest", "temperate_forest");
  if (/صحر|desert|رمل/.test(t)) out.push("desert");
  if (/جبل|mountain/.test(t)) out.push("mountain");
  if (/مستنقع|swamp/.test(t)) out.push("swamp");
  if (/ساحل|coast|بحر|ocean/.test(t)) out.push("coast");
  if (/ثلج|ice|قطب|tundra/.test(t)) out.push("tundra", "ice");
  if (!out.length) out.push("plains", "temperate_forest", "coast");
  return [...new Set(out)];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
