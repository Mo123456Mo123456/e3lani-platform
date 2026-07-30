import type {
  CausalGraph,
  FutureScenario,
  SimulationEffect,
  StructuredContribution,
  WorldEventDto,
} from "@planet/shared-types";
import { buildCausalGraph } from "./causal.js";
import { SeededRng, hashString } from "./rng.js";
import type { WorldState } from "./world-state.js";
import { advanceTicks, runMonteCarloForecast } from "./tick-engine.js";

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

export function computeContributionEffects(
  structured: StructuredContribution,
  regionBiome: string,
): SimulationEffect[] {
  const t = structured.traits;
  const suitable = structured.possibleBiomes.includes(regionBiome as never);
  const suitability = suitable ? 1 : 0.35;
  const effects: SimulationEffect[] = [];

  if (structured.category === "plant" || t.pollutionAbsorption) {
    effects.push({
      domain: "pollution",
      metric: "pollution",
      delta: -((t.pollutionAbsorption ?? 0.2) * 0.2 * suitability),
      confidence: 0.85,
      explanationKey: "plant_absorbs_pollution",
    });
    effects.push({
      domain: "environment",
      metric: "water_stress",
      delta: (t.waterNeed ?? 0.4) * 0.15 * suitability,
      confidence: 0.8,
      explanationKey: "high_water_use",
    });
    effects.push({
      domain: "plants",
      metric: "coverage",
      delta: (t.growthRate ?? 0.3) * 0.1 * suitability,
      confidence: 0.8,
      explanationKey: "plant_growth",
    });
  }

  if (structured.category === "creature") {
    effects.push({
      domain: "creatures",
      metric: "biodiversity",
      delta: 0.05 * suitability,
      confidence: 0.8,
      explanationKey: "species_introduced",
    });
    if ((t.aggression ?? 0) > 0.6) {
      effects.push({
        domain: "creatures",
        metric: "predation_pressure",
        delta: 0.08,
        confidence: 0.75,
        explanationKey: "aggressive_species",
      });
    }
  }

  if (
    structured.category === "civilization" ||
    structured.category === "city" ||
    structured.category === "culture"
  ) {
    effects.push({
      domain: "civilizations",
      metric: "settlement",
      delta: 0.1,
      confidence: 0.85,
      explanationKey: "settlement_founded",
    });
    effects.push({
      domain: "politics",
      metric: "stability",
      delta: -0.03,
      confidence: 0.6,
      explanationKey: "new_power_center",
    });
  }

  if (
    structured.category === "invention" ||
    structured.category === "technology" ||
    structured.category === "energy"
  ) {
    effects.push({
      domain: "inventions",
      metric: "tech_level",
      delta: 0.07,
      confidence: 0.8,
      explanationKey: "tech_boost",
    });
    effects.push({
      domain: "economy",
      metric: "productivity",
      delta: 0.05,
      confidence: 0.75,
      explanationKey: "tech_economy",
    });
    if ((t.pollutionAbsorption ?? 0) < 0.2) {
      effects.push({
        domain: "pollution",
        metric: "pollution",
        delta: 0.04,
        confidence: 0.7,
        explanationKey: "industrial_side_effect",
      });
    }
  }

  if (structured.category === "resource") {
    effects.push({
      domain: "resources",
      metric: "resource_value",
      delta: 0.08,
      confidence: 0.85,
      explanationKey: "resource_added",
    });
    effects.push({
      domain: "wars",
      metric: "conflict_pressure",
      delta: 0.05,
      confidence: 0.65,
      explanationKey: "resource_contention",
    });
  }

  if (structured.category === "disease") {
    effects.push({
      domain: "disease",
      metric: "outbreak_risk",
      delta: 0.12,
      confidence: 0.9,
      explanationKey: "disease_introduced",
    });
    effects.push({
      domain: "population",
      metric: "population",
      delta: -0.05,
      confidence: 0.75,
      explanationKey: "disease_ toll",
    });
  }

  if (structured.category === "disaster" || structured.category === "climate") {
    effects.push({
      domain: "climate",
      metric: "instability",
      delta: 0.1,
      confidence: 0.85,
      explanationKey: "climate_shock",
    });
  }

  if (!effects.length) {
    effects.push({
      domain: "future",
      metric: "novelty",
      delta: 0.04,
      confidence: 0.6,
      explanationKey: "generic_impact",
    });
  }

  return effects;
}

export interface ApplyContributionInput {
  state: WorldState;
  userId: string;
  contributionId: string;
  regionId: string;
  structured: StructuredContribution;
  simulateYears?: number;
}

export interface ApplyContributionResult {
  state: WorldState;
  event: WorldEventDto;
  effects: SimulationEffect[];
  causalGraph: CausalGraph;
  scenarios: FutureScenario[];
  successProbability: number;
}

export function applyContribution(input: ApplyContributionInput): ApplyContributionResult {
  const state = structuredClone(input.state);
  const region = state.regions.find((r) => r.id === input.regionId);
  if (!region) throw new Error("Region not found");

  const effects = computeContributionEffects(input.structured, region.biome);
  const suitable = input.structured.possibleBiomes.includes(region.biome as never);
  const successProbability = clamp(
    (suitable ? 0.72 : 0.35) +
      (input.structured.traits.adaptability ?? 0.3) * 0.2 -
      (input.structured.risks.length > 3 ? 0.1 : 0),
  );

  const rng = new SeededRng(hashString(`${state.seed}:${input.contributionId}`));

  state.contributions.push({
    id: input.contributionId,
    userId: input.userId,
    category: input.structured.category,
    structured: input.structured,
    regionId: region.id,
    appliedTick: state.tick,
  });

  if (
    input.structured.category === "plant" ||
    input.structured.originalIdea.includes("شجرة") ||
    input.structured.originalIdea.toLowerCase().includes("tree")
  ) {
    const plant = {
      id: `plt_user_${input.contributionId}`,
      name: input.structured.name,
      nameEn: input.structured.nameEn ?? input.structured.name,
      coverage: 0.05,
      growthRate: input.structured.traits.growthRate ?? 0.3,
      waterNeed: input.structured.traits.waterNeed ?? 0.5,
      pollutionAbsorption: input.structured.traits.pollutionAbsorption ?? 0.4,
      luminosity: input.structured.traits.nightLuminosity ?? 0,
      preferredBiomes: input.structured.possibleBiomes,
      contributionId: input.contributionId,
    };
    state.plants.push(plant);
    region.plantIds.push(plant.id);
    region.pollution = clamp(
      region.pollution - (plant.pollutionAbsorption * 0.15 * successProbability),
    );
    region.moisture = clamp(region.moisture - plant.waterNeed * 0.05);
  } else if (input.structured.category === "creature") {
    const species = {
      id: `spc_user_${input.contributionId}`,
      name: input.structured.name,
      nameEn: input.structured.nameEn ?? input.structured.name,
      population: Math.floor(200 * successProbability),
      size: input.structured.traits.size ?? 0.4,
      reproduction: input.structured.traits.reproduction ?? 0.3,
      aggression: input.structured.traits.aggression ?? 0.3,
      intelligence: input.structured.traits.intelligence ?? 0.3,
      heatResistance: input.structured.traits.heatResistance ?? 0.5,
      coldResistance: input.structured.traits.coldResistance ?? 0.5,
      waterNeed: input.structured.traits.waterNeed ?? 0.4,
      adaptability: input.structured.traits.adaptability ?? 0.5,
      preferredBiomes: input.structured.possibleBiomes,
      preyOf: [],
      foodOf: [],
      contributionId: input.contributionId,
    };
    state.species.push(species);
    region.speciesIds.push(species.id);
  } else if (
    input.structured.category === "civilization" ||
    input.structured.category === "city"
  ) {
    const civId = `civ_user_${input.contributionId}`;
    state.civilizations.push({
      id: civId,
      name: input.structured.name,
      nameEn: input.structured.nameEn ?? input.structured.name,
      population: Math.floor(3000 * successProbability),
      techLevel: 0.2,
      military: 0.3,
      economy: 0.35,
      food: 0.55,
      stability: 0.5,
      aggression: input.structured.traits.aggression ?? 0.3,
      innovation: input.structured.traits.intelligence ?? 0.4,
      happiness: 0.55,
      pollution: 0.1,
      education: 0.4,
      capitalRegionId: region.id,
      cityIds: [],
      allyIds: [],
      enemyIds: [],
      memory: [],
      contributionId: input.contributionId,
    });
    region.civilizationId = civId;
    region.population = Math.min(
      region.carryingCapacity,
      region.population + 1200,
    );
  } else if (
    input.structured.category === "invention" ||
    input.structured.category === "technology" ||
    input.structured.category === "energy"
  ) {
    const holders = state.civilizations
      .filter((c) => c.capitalRegionId === region.id || rng.chance(0.2))
      .map((c) => c.id)
      .slice(0, 3);
    state.technologies.push({
      id: `tech_user_${input.contributionId}`,
      name: input.structured.name,
      nameEn: input.structured.nameEn ?? input.structured.name,
      level: 0.4 + (input.structured.traits.intelligence ?? 0.3) * 0.3,
      civilizationIds: holders.length ? holders : [state.civilizations[0]!.id],
      contributionId: input.contributionId,
    });
  } else if (input.structured.category === "resource") {
    const res = {
      id: `res_user_${input.contributionId}`,
      name: input.structured.name,
      nameEn: input.structured.nameEn ?? input.structured.name,
      regionId: region.id,
      quantity: 1000,
      renewal: 0.1,
      value: 0.7,
      extraction: 0.1,
      environmentalImpact: 0.2,
    };
    state.resources.push(res);
    region.resourceIds.push(res.id);
  } else if (input.structured.category === "disease") {
    state.diseases.push({
      id: `dis_user_${input.contributionId}`,
      name: input.structured.name,
      infectivity: input.structured.traits.infectivity ?? 0.5,
      severity: input.structured.traits.severity ?? 0.4,
      regionIds: [region.id],
    });
  }

  // nearby civ competition for water-heavy plants
  if ((input.structured.traits.waterNeed ?? 0) > 0.65) {
    const nearbyCivs = state.civilizations.filter((c) => {
      const cap = state.regions.find((r) => r.id === c.capitalRegionId);
      if (!cap) return false;
      return Math.hypot(cap.x - region.x, cap.y - region.y) < 8;
    });
    if (nearbyCivs.length >= 2 && rng.chance(0.7)) {
      effects.push({
        domain: "wars",
        metric: "conflict_pressure",
        delta: 0.08,
        confidence: 0.7,
        explanationKey: "water_competition",
      });
    }
  }

  const event: WorldEventDto = {
    id: `evt_contrib_${input.contributionId}`,
    type: "USER_CONTRIBUTION_APPLIED",
    title: `إضافة: ${input.structured.name}`,
    titleEn: `Added: ${input.structured.nameEn ?? input.structured.name}`,
    summary: `أُدخل عنصر المستخدم إلى ${region.name} وبدأت سلسلة سببية قابلة للتتبع.`,
    summaryEn: `User element entered ${region.nameEn} and started a traceable causal chain.`,
    tick: state.tick,
    year: state.year,
    importance: 0.9,
    regionId: region.id,
    lat: region.lat,
    lng: region.lng,
    cause: input.structured.originalIdea,
    causes: [`user:${input.userId}`, `category:${input.structured.category}`],
    effects,
    contributionId: input.contributionId,
    userId: input.userId,
    confidence: successProbability,
    createdAt: new Date().toISOString(),
  };
  state.eventLog.push(event);

  const simulateYears = input.simulateYears ?? 1;
  const advanced = advanceTicks(state, simulateYears);

  const mc = runMonteCarloForecast(state, [1, 10, 100], 5);
  const scenarios: FutureScenario[] = [];
  for (const bundle of mc) {
    const scores = bundle.paths.map((p) =>
      p.effects.reduce((a, e) => a + e.delta, 0),
    );
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const bestIdx = scores.indexOf(Math.max(...scores));
    const worstIdx = scores.indexOf(Math.min(...scores));
    const variance =
      scores.reduce((a, s) => a + (s - avg) ** 2, 0) / Math.max(1, scores.length);

    const make = (
      label: FutureScenario["label"],
      idx: number,
      probability: number,
    ): FutureScenario => ({
      horizonYears: bundle.horizonYears,
      label,
      probability,
      uncertainty: clamp(Math.sqrt(variance)),
      narrative: "",
      narrativeEn: "",
      keyFactors: bundle.paths[idx]!.events.slice(0, 3).map((e) => e.type),
      effects: bundle.paths[idx]!.effects.slice(0, 8),
    });

    scenarios.push(make("most_likely", Math.floor(scores.length / 2), 0.5));
    scenarios.push(make("best", bestIdx, 0.2));
    scenarios.push(make("worst", worstIdx, 0.2));
  }

  return {
    state: advanced.state,
    event,
    effects: [...effects, ...advanced.effects],
    causalGraph: buildCausalGraph(input.structured.name, effects),
    scenarios,
    successProbability,
  };
}
