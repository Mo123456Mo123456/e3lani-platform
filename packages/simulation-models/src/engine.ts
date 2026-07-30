import { SIM_YEARS_PER_TICK } from "@planet-born/config";
import type {
  StructuredContribution,
  TickUnit,
  WorldEventType,
} from "@planet-born/shared-types";
import { balanceContribution } from "./balance.js";
import { CausalGraph } from "./causal-graph.js";
import {
  applyCivilizationAction,
  decideCivilizationAction,
  type CivilizationState,
} from "./civilizations.js";
import { initClimate, stepClimateGrid, type ClimateState } from "./climate.js";
import { stepResourceEconomy, type ResourceNode } from "./economy.js";
import {
  stepSpeciesPopulations,
  type SpeciesState,
} from "./ecology.js";
import { SeededRng, clamp, hashString } from "./rng.js";
import { generateWorld, type GeneratedWorld } from "./world-generator.js";

export type SimEvent = {
  id: string;
  type: WorldEventType | string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  tick: number;
  simYear: number;
  importance: number;
  cause?: string;
  causeIds: string[];
  regionIndex?: number;
  location?: { lat: number; lon: number };
  contributionId?: string;
  userId?: string;
  directEffects: Record<string, unknown>;
  confidence: number;
};

export type PlantState = {
  id: string;
  name: string;
  regionIndexes: number[];
  traits: Record<string, number>;
  coverage: number;
  contributionId?: string;
};

export type WorldState = {
  seed: string;
  tick: number;
  year: number;
  tickUnit: TickUnit;
  world: GeneratedWorld;
  climate: ClimateState[];
  civilizations: CivilizationState[];
  species: SpeciesState[];
  plants: PlantState[];
  resources: ResourceNode[];
  events: SimEvent[];
  causal: CausalGraph;
  foodWeb: Map<string, string[]>;
  rngState: number;
  cities?: CityRecord[];
  technologies?: TechnologyRecord[];
};

function uuidFrom(seed: string, n: number): string {
  const h = hashString(`${seed}:${n}`).toString(16).padStart(8, "0");
  const h2 = hashString(`${seed}:b:${n}`).toString(16).padStart(8, "0");
  return `${h.slice(0, 8)}-${h.slice(0, 4)}-4${h.slice(1, 4)}-a${h2.slice(0, 3)}-${h2}${h}`.slice(0, 36);
}

export type InitialWorldOptions = {
  tickUnit?: TickUnit;
  width?: number;
  height?: number;
  /** Dense demo defaults match product seed targets */
  speciesCount?: number;
  plantCount?: number;
  resourceCount?: number;
  cityCount?: number;
  technologyCount?: number;
  bootstrapTicks?: number;
};

export type CityRecord = {
  id: string;
  name: string;
  civilizationId: string;
  regionId: string;
  population: number;
};

export type TechnologyRecord = {
  id: string;
  name: string;
  level: number;
  category: string;
  discoveredBy?: string;
};

export function createInitialWorld(
  seed: string,
  tickUnitOrOptions: TickUnit | InitialWorldOptions = "year",
): WorldState {
  const options: InitialWorldOptions =
    typeof tickUnitOrOptions === "string"
      ? { tickUnit: tickUnitOrOptions }
      : tickUnitOrOptions;
  const tickUnit = options.tickUnit ?? "year";
  const speciesCount = options.speciesCount ?? 300;
  const plantCount = options.plantCount ?? 800;
  const resourceCount = options.resourceCount ?? 120;
  const cityCount = options.cityCount ?? 40;
  const technologyCount = options.technologyCount ?? 50;
  const bootstrapTicks = options.bootstrapTicks ?? 12;

  const world = generateWorld(seed, options.width ?? 48, options.height ?? 24);
  const rng = new SeededRng(seed);
  const climate = world.cells.map(initClimate);

  const landIndexes = world.cells
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.isOcean);

  const civNames = [
    ["أوراليا", "Auralia"],
    ["نهرين", "Nahrayn"],
    ["قمريا", "Qamaria"],
    ["سفّارا", "Saffara"],
    ["ثلجيّة", "Thaljiya"],
    ["واحات الشرق", "Eastern Oases"],
    ["صخور الريح", "Windrock"],
    ["غاب الظلال", "Shadowgrove"],
    ["مرافئ الجنوب", "Southern Ports"],
    ["قلاع الشمال", "Northern Keeps"],
    ["جزائر اللؤلؤ", "Pearl Isles"],
    ["سهوب الحرية", "Freedom Steppe"],
  ];

  const civilizations: CivilizationState[] = civNames.map(([name], idx) => {
    const home = landIndexes[rng.int(0, landIndexes.length - 1)]!;
    return {
      id: uuidFrom(seed, 1000 + idx),
      name: name!,
      population: rng.int(4000, 45000),
      cities: 0,
      techLevel: rng.float(0.1, 0.55),
      military: rng.float(0.15, 0.7),
      food: rng.float(0.35, 0.85),
      economy: rng.float(0.25, 0.8),
      health: rng.float(0.4, 0.9),
      stability: rng.float(0.35, 0.85),
      education: rng.float(0.2, 0.75),
      pollution: rng.float(0.05, 0.35),
      happiness: rng.float(0.35, 0.8),
      innovation: rng.float(0.2, 0.7),
      aggression: rng.float(0.1, 0.7),
      regionIds: [String(home.i)],
      enemies: [],
      allies: [],
      memory: [],
    };
  });

  const cities: CityRecord[] = [];
  for (let i = 0; i < cityCount; i++) {
    const civ = civilizations[i % civilizations.length]!;
    const home = landIndexes[rng.int(0, landIndexes.length - 1)]!;
    const city: CityRecord = {
      id: uuidFrom(seed, 5000 + i),
      name: `مدينة-${i + 1}`,
      civilizationId: civ.id,
      regionId: String(home.i),
      population: rng.int(800, 12000),
    };
    cities.push(city);
    civ.cities += 1;
    if (!civ.regionIds.includes(city.regionId)) civ.regionIds.push(city.regionId);
  }

  const technologies: TechnologyRecord[] = [];
  const techCategories = ["agriculture", "energy", "warfare", "medicine", "navigation", "writing"];
  for (let i = 0; i < technologyCount; i++) {
    const civ = civilizations[rng.int(0, civilizations.length - 1)]!;
    technologies.push({
      id: uuidFrom(seed, 6000 + i),
      name: `تقنية-${i + 1}`,
      level: rng.float(0.1, 0.9),
      category: rng.pick(techCategories),
      discoveredBy: civ.id,
    });
  }

  const species: SpeciesState[] = [];
  for (let i = 0; i < speciesCount; i++) {
    const home = landIndexes[rng.int(0, landIndexes.length - 1)]!;
    species.push({
      id: uuidFrom(seed, 2000 + i),
      name: `نوع-${i + 1}`,
      population: rng.int(200, 8000),
      traits: {
        size: rng.float(0.1, 0.9),
        lifespan: rng.float(0.2, 0.9),
        reproductionRate: rng.float(0.15, 0.65),
        foodNeed: rng.float(0.2, 0.8),
        heatResistance: rng.float(0.1, 0.9),
        coldResistance: rng.float(0.1, 0.9),
        waterNeed: rng.float(0.2, 0.8),
        intelligence: rng.float(0.05, 0.7),
        aggression: rng.float(0.05, 0.8),
        mobility: rng.float(0.1, 0.9),
        adaptability: rng.float(0.2, 0.8),
        mutationRate: rng.float(0.05, 0.4),
        extinctionRisk: rng.float(0.05, 0.35),
      },
      habitatBiomes: [home.c.biome],
      trophicLevel: rng.float(0, 1),
      regionIds: [String(home.i)],
    });
  }

  const foodWeb = new Map<string, string[]>();
  const sorted = [...species].sort((a, b) => a.trophicLevel - b.trophicLevel);
  for (let i = 0; i < sorted.length; i++) {
    const pred = sorted[i]!;
    if (pred.trophicLevel < 0.35) continue;
    const prey = sorted
      .filter((s) => s.trophicLevel < pred.trophicLevel - 0.1)
      .slice(0, 3)
      .map((s) => s.id);
    if (prey.length) foodWeb.set(pred.id, prey);
  }

  const plants: PlantState[] = [];
  for (let i = 0; i < plantCount; i++) {
    const home = landIndexes[rng.int(0, landIndexes.length - 1)]!;
    plants.push({
      id: uuidFrom(seed, 3000 + i),
      name: `نبات-${i + 1}`,
      regionIndexes: [home.i],
      traits: {
        growthRate: rng.float(0.1, 0.7),
        waterNeed: rng.float(0.2, 0.9),
        pollutionAbsorption: rng.float(0, 0.4),
      },
      coverage: rng.float(0.05, 0.4),
    });
  }

  const resources: ResourceNode[] = [];
  for (let i = 0; i < resourceCount; i++) {
    const home = landIndexes[rng.int(0, landIndexes.length - 1)]!;
    resources.push({
      id: uuidFrom(seed, 4000 + i),
      name: `مورد-${i + 1}`,
      regionId: String(home.i),
      quantity: rng.float(50, 500),
      regenRate: rng.float(0.5, 5),
      extractRate: rng.float(1, 8),
      value: rng.float(0.5, 5),
      environmentalImpact: rng.float(0.05, 0.4),
    });
  }

  const causal = new CausalGraph();
  const genesisId = uuidFrom(seed, 1);
  causal.addNode({
    id: genesisId,
    label: "نشأة الكوكب",
    tick: 0,
    kind: "genesis",
  });

  const milestoneTitles: Array<{ type: SimEvent["type"]; title: string; titleEn: string; year: number }> = [
    { type: "CLIMATE_CHANGED", title: "نشأة المحيطات", titleEn: "Oceans formed", year: 0 },
    { type: "SPECIES_CREATED", title: "أول كائن حي", titleEn: "First living organism", year: 150 },
    { type: "PLANT_SPREAD", title: "ظهور النباتات", titleEn: "Plants appear", year: 300 },
    { type: "CIVILIZATION_FOUNDED", title: "بداية الحضارات", titleEn: "Civilizations begin", year: 800 },
    { type: "RESOURCE_DISCOVERED", title: "اكتشاف المعادن", titleEn: "Metals discovered", year: 950 },
    { type: "TECHNOLOGY_DISCOVERED", title: "الثورة التقنية الأولى", titleEn: "First tech revolution", year: 1100 },
  ];

  const events: SimEvent[] = milestoneTitles.map((m, idx) => {
    const id = idx === 0 ? genesisId : uuidFrom(seed, 10 + idx);
    if (idx > 0) {
      causal.addNode({ id, label: m.title, tick: idx, kind: String(m.type) });
      causal.link(idx === 1 ? genesisId : uuidFrom(seed, 9 + idx), id, "caused", 0.8, 1);
    }
    return {
      id,
      type: m.type,
      title: m.title,
      titleEn: m.titleEn,
      description: `${m.title} — معلم تاريخي في تطور الكوكب.`,
      descriptionEn: `${m.titleEn} — a historical milestone in planetary evolution.`,
      tick: idx,
      simYear: m.year,
      importance: 1 - idx * 0.05,
      causeIds: idx === 0 ? [] : [idx === 1 ? genesisId : uuidFrom(seed, 9 + idx)],
      directEffects: { milestone: true, year: m.year },
      confidence: 1,
    };
  });

  let state: WorldState = {
    seed,
    tick: milestoneTitles.length - 1,
    year: milestoneTitles[milestoneTitles.length - 1]!.year,
    tickUnit,
    world,
    climate,
    civilizations,
    species,
    plants,
    resources,
    events,
    causal,
    foodWeb,
    rngState: rng.getState(),
    cities,
    technologies,
  };

  // Bootstrap a short simulated history so the event log is alive on first load
  if (bootstrapTicks > 0) {
    state = stepSimulation(state, bootstrapTicks);
  }
  return state;
}

export function serializeWorldState(state: WorldState): string {
  return JSON.stringify({
    ...state,
    foodWeb: Array.from(state.foodWeb.entries()),
    causal: state.causal.toJSON(),
  });
}

export function deserializeWorldState(raw: string): WorldState {
  const data = JSON.parse(raw) as Omit<WorldState, "foodWeb" | "causal"> & {
    foodWeb: Array<[string, string[]]>;
    causal: ReturnType<CausalGraph["toJSON"]>;
  };
  return {
    ...data,
    foodWeb: new Map(data.foodWeb),
    causal: CausalGraph.fromJSON(data.causal),
  };
}

function pushEvent(state: WorldState, event: Omit<SimEvent, "id" | "tick" | "simYear"> & { id?: string }): SimEvent {
  const id = event.id ?? uuidFrom(state.seed, state.events.length + state.tick * 10007 + hashString(event.title));
  const full: SimEvent = {
    ...event,
    id,
    tick: state.tick,
    simYear: state.year,
    causeIds: event.causeIds ?? [],
    directEffects: event.directEffects ?? {},
    confidence: event.confidence ?? 1,
  };
  state.events.push(full);
  state.causal.addNode({
    id: full.id,
    label: full.title,
    tick: full.tick,
    kind: String(full.type),
    metrics: Object.fromEntries(
      Object.entries(full.directEffects)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => [k, v as number]),
    ),
  });
  for (const causeId of full.causeIds) {
    state.causal.link(causeId, full.id, "caused", full.importance, 0);
  }
  return full;
}

/**
 * Advance the simulation by N ticks. Fully deterministic for a given seed+state.
 */
export function stepSimulation(state: WorldState, ticks = 1): WorldState {
  const next = deserializeWorldState(serializeWorldState(state));
  const rng = new SeededRng(0);
  rng.setState(next.rngState);
  const yearsPerTick = SIM_YEARS_PER_TICK[next.tickUnit] ?? 1;

  for (let t = 0; t < ticks; t++) {
    next.tick += 1;
    next.year += yearsPerTick;

    const emissions =
      next.civilizations.reduce((a, c) => a + c.pollution * c.techLevel, 0) /
      Math.max(1, next.civilizations.length);
    const volcanic = rng.chance(0.02) ? rng.float(0.2, 0.8) : 0;
    if (volcanic > 0) {
      const volcanoCells = next.world.cells.filter(
        (c) => c.biome === "volcanic" || c.biome === "mountain",
      );
      const cell =
        volcanoCells.length > 0
          ? rng.pick(volcanoCells)
          : next.world.cells[rng.int(0, next.world.cells.length - 1)];
      pushEvent(next, {
        type: "VOLCANO_ERUPTED",
        title: "ثوران بركاني",
        titleEn: "Volcanic eruption",
        description: "أطلق البركان رمادًا أثر على المناخ الإقليمي.",
        descriptionEn: "A volcano released ash affecting regional climate.",
        importance: 0.75,
        causeIds: [],
        location: cell ? { lat: cell.lat, lon: cell.lon } : undefined,
        directEffects: { volcanicAsh: volcanic },
        confidence: 0.9,
      });
    }

    next.climate = stepClimateGrid(
      next.world.cells,
      next.climate,
      next.world.width,
      next.world.height,
      emissions,
      volcanic,
    );

    // Plant pollution absorption
    for (const plant of next.plants) {
      const absorb = (plant.traits.pollutionAbsorption ?? 0) * plant.coverage * 0.01;
      for (const ri of plant.regionIndexes) {
        const c = next.climate[ri];
        if (c) c.pollution = clamp(c.pollution - absorb, 0, 1);
      }
      plant.coverage = clamp(
        plant.coverage + (plant.traits.growthRate ?? 0.2) * 0.02,
        0,
        1,
      );
    }

    const carrying = new Map<string, number>();
    for (const s of next.species) {
      for (const r of s.regionIds) {
        const idx = Number(r);
        const fert = next.world.cells[idx]?.fertility ?? 0.3;
        carrying.set(r, (carrying.get(r) ?? 0) + 500 + fert * 2000);
      }
    }

    const eco = stepSpeciesPopulations(next.species, carrying, next.foodWeb, rng.fork(`eco-${next.tick}`), yearsPerTick);
    next.species = eco.next;
    for (const id of eco.extinctions) {
      pushEvent(next, {
        type: "SPECIES_EXTINCT",
        title: "انقراض نوع",
        titleEn: "Species extinct",
        description: `انقرض النوع ${id} بسبب الضغط البيئي أو الافتراس.`,
        descriptionEn: `Species ${id} went extinct due to pressure or predation.`,
        importance: 0.7,
        causeIds: [],
        directEffects: { speciesId: id },
        confidence: 0.95,
      });
    }
    for (const m of eco.mutations) {
      pushEvent(next, {
        type: "SPECIES_MUTATED",
        title: `طفرة: ${m.name}`,
        titleEn: `Mutation: ${m.name}`,
        description: "ظهر نوع فرعي بصفات متكيفة جديدة.",
        descriptionEn: "A subspecies emerged with new adaptive traits.",
        importance: 0.5,
        causeIds: [],
        directEffects: { speciesId: m.id },
        confidence: 0.8,
      });
    }

    next.resources = stepResourceEconomy(
      next.resources,
      0.8 + next.civilizations.reduce((a, c) => a + c.economy, 0) / next.civilizations.length,
    );

    const occupied = new Set(next.civilizations.flatMap((c) => c.regionIds));
    const freeRegions = next.world.cells
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => !c.isOcean && !occupied.has(String(i)))
      .map(({ i }) => String(i));

    const civMap = new Map(next.civilizations.map((c) => [c.id, c]));
    for (const civ of next.civilizations) {
      const action = decideCivilizationAction(
        civ,
        next.civilizations,
        freeRegions,
        rng.fork(`civ-${civ.id}-${next.tick}`),
      );
      const { events } = applyCivilizationAction(civ, action, civMap, next.tick);
      for (const e of events) {
        pushEvent(next, {
          type: e.type,
          title: e.title,
          description: e.title,
          importance: e.importance,
          causeIds: [],
          directEffects: e.meta,
          confidence: 0.85,
        });
      }
    }

    // Climate extremes
    const avgStorm =
      next.climate.reduce((a, c) => a + c.stormIntensity, 0) / next.climate.length;
    if (avgStorm > 0.55 && rng.chance(0.15)) {
      pushEvent(next, {
        type: "CLIMATE_CHANGED",
        title: "عاصفة مناخية كبرى",
        titleEn: "Major climate storm",
        description: "ارتفعت شدة العواصف عبر المناطق الرطبة الدافئة.",
        descriptionEn: "Storm intensity rose across warm moist regions.",
        importance: 0.65,
        causeIds: [],
        directEffects: { avgStorm },
        confidence: 0.8,
      });
    }
  }

  next.rngState = rng.getState();
  return next;
}

export type AppliedContribution = {
  state: WorldState;
  contributionId: string;
  rootEventId: string;
  previewEvents: SimEvent[];
};

/**
 * Apply a user contribution into the world with causal tracking.
 */
export function applyContribution(
  state: WorldState,
  contribution: StructuredContribution,
  location: { lat: number; lon: number },
  userId?: string,
): AppliedContribution {
  const balanced = balanceContribution(contribution);
  const next = deserializeWorldState(serializeWorldState(state));
  const contributionId = uuidFrom(next.seed, next.events.length + 900000 + hashString(balanced.name));

  // Find nearest land cell
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < next.world.cells.length; i++) {
    const c = next.world.cells[i]!;
    if (c.isOcean) continue;
    const d = (c.lat - location.lat) ** 2 + (c.lon - location.lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const root = pushEvent(next, {
    id: contributionId,
    type: "USER_CONTRIBUTION_APPLIED",
    title: `إضافة: ${balanced.name}`,
    titleEn: `Added: ${balanced.nameEn ?? balanced.name}`,
    description: balanced.description ?? `أُضيف عنصر من فئة ${balanced.category} إلى العالم.`,
    descriptionEn: balanced.description ?? `A ${balanced.category} was added to the world.`,
    importance: 0.85,
    causeIds: [],
    location,
    regionIndex: bestIdx,
    contributionId,
    userId,
    directEffects: {
      category: balanced.category,
      traits: balanced.traits,
      wasBalanced: balanced.wasBalanced,
      balanceNotes: balanced.balanceNotes,
    },
    confidence: 1,
  });

  if (balanced.category === "plant") {
    const plant: PlantState = {
      id: uuidFrom(next.seed, hashString(contributionId)),
      name: balanced.name,
      regionIndexes: [bestIdx],
      traits: balanced.traits,
      coverage: 0.08,
      contributionId,
    };
    next.plants.push(plant);
    const spread = pushEvent(next, {
      type: "PLANT_SPREAD",
      title: `انتشار ${balanced.name}`,
      titleEn: `${balanced.name} begins spreading`,
      description: "بدأ النبات بالنمو في المنطقة المختارة.",
      descriptionEn: "The plant began growing in the selected region.",
      importance: 0.5,
      causeIds: [root.id],
      location,
      regionIndex: bestIdx,
      contributionId,
      userId,
      directEffects: { plantId: plant.id, coverage: plant.coverage },
      confidence: 0.95,
    });
    void spread;
    const absorb = balanced.traits.pollutionAbsorption ?? 0;
    if (absorb > 0.3) {
      const c = next.climate[bestIdx]!;
      c.pollution = clamp(c.pollution - absorb * 0.1, 0, 1);
      pushEvent(next, {
        type: "POLLUTION_CHANGED",
        title: "انخفاض التلوث المحلي",
        titleEn: "Local pollution drop",
        description: `امتصاص التلوث بدأ بفضل ${balanced.name}.`,
        descriptionEn: `Pollution absorption began thanks to ${balanced.name}.`,
        importance: 0.55,
        causeIds: [root.id],
        contributionId,
        userId,
        directEffects: { pollution: c.pollution, delta: -absorb * 0.1 },
        confidence: 0.9,
      });
    }
  } else if (balanced.category === "creature") {
    const sp: SpeciesState = {
      id: uuidFrom(next.seed, hashString(contributionId + "sp")),
      name: balanced.name,
      population: 120,
      traits: {
        size: balanced.traits.size ?? 0.4,
        lifespan: balanced.traits.lifespan ?? 0.5,
        reproductionRate: balanced.traits.reproductionRate ?? 0.35,
        foodNeed: balanced.traits.foodNeed ?? 0.4,
        heatResistance: balanced.traits.heatResistance ?? 0.5,
        coldResistance: balanced.traits.coldResistance ?? 0.4,
        waterNeed: balanced.traits.waterNeed ?? 0.5,
        intelligence: balanced.traits.intelligence ?? 0.3,
        aggression: balanced.traits.aggression ?? 0.3,
        mobility: balanced.traits.mobility ?? 0.4,
        adaptability: balanced.traits.adaptability ?? 0.5,
        mutationRate: balanced.traits.mutationRate ?? 0.2,
        extinctionRisk: balanced.traits.extinctionRisk ?? 0.2,
      },
      habitatBiomes: balanced.possibleBiomes,
      trophicLevel: balanced.traits.aggression ?? 0.3,
      regionIds: [String(bestIdx)],
    };
    next.species.push(sp);
    pushEvent(next, {
      type: "SPECIES_CREATED",
      title: `ظهور ${balanced.name}`,
      titleEn: `${balanced.name} appeared`,
      description: "دخل مخلوق جديد إلى النظام البيئي.",
      descriptionEn: "A new creature entered the ecosystem.",
      importance: 0.7,
      causeIds: [root.id],
      location,
      contributionId,
      userId,
      directEffects: { speciesId: sp.id, population: sp.population },
      confidence: 1,
    });
  } else if (balanced.category === "civilization") {
    const civ: CivilizationState = {
      id: uuidFrom(next.seed, hashString(contributionId + "civ")),
      name: balanced.name,
      population: 2500,
      cities: 1,
      techLevel: balanced.traits.techLevel ?? 0.2,
      military: balanced.traits.military ?? 0.25,
      food: 0.6,
      economy: 0.4,
      health: 0.7,
      stability: 0.6,
      education: balanced.traits.education ?? 0.3,
      pollution: 0.1,
      happiness: 0.6,
      innovation: balanced.traits.innovation ?? 0.35,
      aggression: balanced.traits.aggression ?? 0.25,
      regionIds: [String(bestIdx)],
      enemies: [],
      allies: [],
      memory: [],
    };
    next.civilizations.push(civ);
    pushEvent(next, {
      type: "CIVILIZATION_FOUNDED",
      title: `تأسيس حضارة ${balanced.name}`,
      titleEn: `Civilization founded: ${balanced.name}`,
      description: "نشأت حضارة جديدة على الكوكب.",
      descriptionEn: "A new civilization rose on the planet.",
      importance: 0.9,
      causeIds: [root.id],
      location,
      contributionId,
      userId,
      directEffects: { civilizationId: civ.id },
      confidence: 1,
    });
  } else if (balanced.category === "resource" || balanced.category === "energy_source") {
    const res: ResourceNode = {
      id: uuidFrom(next.seed, hashString(contributionId + "res")),
      name: balanced.name,
      regionId: String(bestIdx),
      quantity: 200 * (balanced.traits.abundance ?? 0.5),
      regenRate: (balanced.traits.regenRate ?? 0.3) * 3,
      extractRate: 2,
      value: (balanced.traits.value ?? 0.5) * 4,
      environmentalImpact: balanced.traits.environmentalImpact ?? 0.2,
    };
    next.resources.push(res);
    pushEvent(next, {
      type: "RESOURCE_DISCOVERED",
      title: `اكتشاف ${balanced.name}`,
      titleEn: `Discovered ${balanced.name}`,
      description: "ظهر مورد جديد يمكن للحضارات استغلاله.",
      descriptionEn: "A new resource appeared for civilizations to exploit.",
      importance: 0.65,
      causeIds: [root.id],
      location,
      contributionId,
      userId,
      directEffects: { resourceId: res.id, quantity: res.quantity },
      confidence: 1,
    });
  } else if (balanced.category === "disaster" || balanced.category === "climate_phenomenon") {
    const cellClimate = next.climate[bestIdx]!;
    cellClimate.stormIntensity = clamp(
      cellClimate.stormIntensity + (balanced.traits.intensity ?? 0.6),
      0,
      1,
    );
    pushEvent(next, {
      type: "NATURAL_DISASTER",
      title: balanced.name,
      description: "حدثت ظاهرة طبيعية أثّرت على المنطقة.",
      importance: 0.8,
      causeIds: [root.id],
      location,
      contributionId,
      userId,
      directEffects: { stormIntensity: cellClimate.stormIntensity },
      confidence: 0.9,
    });
  } else if (balanced.category === "disease") {
    pushEvent(next, {
      type: "DISEASE_OUTBREAK",
      title: `تفشي ${balanced.name}`,
      description: "بدأ مرض بالانتشار بين التجمعات القريبة.",
      importance: 0.75,
      causeIds: [root.id],
      location,
      contributionId,
      userId,
      directEffects: { contagion: balanced.traits.contagion ?? 0.4 },
      confidence: 0.85,
    });
    for (const civ of next.civilizations) {
      if (civ.regionIds.includes(String(bestIdx))) {
        civ.health = clamp(civ.health - 0.1, 0, 1);
        civ.population = Math.floor(civ.population * 0.97);
      }
    }
  } else {
    // Generic invention / culture / etc.
    pushEvent(next, {
      type: "TECHNOLOGY_DISCOVERED",
      title: `أثر ${balanced.name}`,
      description: `أُدخل عنصر من فئة ${balanced.category} وبدأ تأثيره السببي.`,
      importance: 0.55,
      causeIds: [root.id],
      location,
      contributionId,
      userId,
      directEffects: { category: balanced.category, traits: balanced.traits },
      confidence: 0.8,
    });
    for (const civ of next.civilizations) {
      if (civ.regionIds.includes(String(bestIdx))) {
        civ.innovation = clamp(civ.innovation + 0.05, 0, 1);
      }
    }
  }

  const previewStart = next.events.length;
  // Short automatic ripple
  const stepped = stepSimulation(next, 1);
  const previewEvents = stepped.events.slice(previewStart);

  return {
    state: stepped,
    contributionId,
    rootEventId: root.id,
    previewEvents,
  };
}

/**
 * Monte Carlo forward scenarios — each sample forks RNG via sample index.
 */
export function runFutureScenarios(
  state: WorldState,
  horizons: number[],
  samples = 12,
): Array<{
  horizonYears: number;
  mostLikely: { narrative: string; metrics: Record<string, number>; probability: number };
  best: { narrative: string; metrics: Record<string, number> };
  worst: { narrative: string; metrics: Record<string, number> };
  uncertainty: number;
  drivers: string[];
}> {
  return horizons.map((horizon) => {
    const results: Array<{ score: number; metrics: Record<string, number>; events: number }> = [];
    for (let s = 0; s < samples; s++) {
      let fork = deserializeWorldState(serializeWorldState(state));
      // Perturb RNG state deterministically per sample
      const rng = new SeededRng(`${state.seed}:mc:${horizon}:${s}`);
      fork.rngState = rng.getState();
      fork = stepSimulation(fork, Math.max(1, Math.round(horizon)));
      const avgPollution =
        fork.climate.reduce((a, c) => a + c.pollution, 0) / fork.climate.length;
      const pop = fork.civilizations.reduce((a, c) => a + c.population, 0);
      const wars = fork.events.filter((e) => e.type === "WAR_STARTED" && e.tick > state.tick).length;
      const extinctions = fork.events.filter((e) => e.type === "SPECIES_EXTINCT" && e.tick > state.tick).length;
      const score = pop / 100000 - avgPollution - wars * 0.1 - extinctions * 0.05;
      results.push({
        score,
        metrics: {
          population: pop,
          pollution: avgPollution,
          wars,
          extinctions,
          civilizations: fork.civilizations.length,
          species: fork.species.length,
        },
        events: fork.events.length - state.events.length,
      });
    }
    results.sort((a, b) => b.score - a.score);
    const best = results[0]!;
    const worst = results[results.length - 1]!;
    const mid = results[Math.floor(results.length / 2)]!;
    const scores = results.map((r) => r.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, scores.length - 1);
    const uncertainty = clamp(Math.sqrt(Math.abs(variance)) / (Math.abs(mean) + 1), 0, 1);

    return {
      horizonYears: horizon,
      mostLikely: {
        narrative: `بعد ${horizon} سنة: السكان ≈ ${Math.round(mid.metrics.population!)}، التلوث ${(mid.metrics.pollution! * 100).toFixed(1)}%، حروب ${mid.metrics.wars}.`,
        metrics: mid.metrics,
        probability: 1 / samples + 0.3,
      },
      best: {
        narrative: `أفضل مسار: ازدهار سكاني مع تلوث ${(best.metrics.pollution! * 100).toFixed(1)}%.`,
        metrics: best.metrics,
      },
      worst: {
        narrative: `أسوأ مسار: ضغط بيئي وحروب ${worst.metrics.wars} وانقراضات ${worst.metrics.extinctions}.`,
        metrics: worst.metrics,
      },
      uncertainty,
      drivers: ["التلوث", "الغذاء", "العدوانية", "انتشار الأنواع", "الندرة"],
    };
  });
}

/** Replay events from a snapshot to verify determinism */
export function replayFromSnapshot(snapshot: WorldState, ticks: number): WorldState {
  return stepSimulation(deserializeWorldState(serializeWorldState(snapshot)), ticks);
}
