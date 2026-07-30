import type { BiomeType, ElementCategory, StructuredElement } from "@planet/shared-types";
import { SeededRandom } from "../rng/seeded-random.js";
import type { GeneratedRegion } from "../world/generator.js";
import { EventStore, makeEventId, type SimEvent } from "../events/store.js";

export interface SpeciesState {
  id: string;
  name: string;
  nameAr: string;
  population: number;
  traits: Record<string, number>;
  biomes: BiomeType[];
  regionIds: string[];
  contributionId?: string;
  trophicLevel: number; // 0 plant-like, 1 herbivore, 2 carnivore
}

export interface PlantState {
  id: string;
  name: string;
  nameAr: string;
  coverage: number;
  traits: Record<string, number>;
  biomes: BiomeType[];
  regionIds: string[];
  contributionId?: string;
}

export interface ResourceState {
  id: string;
  name: string;
  nameAr: string;
  quantity: number;
  renewRate: number;
  value: number;
  regionId: string;
  controllerCivId: string | null;
  contributionId?: string;
}

export interface CityState {
  id: string;
  name: string;
  nameAr: string;
  regionId: string;
  population: number;
  civilizationId: string;
}

export interface CivilizationState {
  id: string;
  name: string;
  nameAr: string;
  population: number;
  techLevel: number;
  military: number;
  economy: number;
  food: number;
  stability: number;
  aggression: number;
  happiness: string;
  education: number;
  pollution: number;
  government: string;
  culture: string;
  language: string;
  regionIds: string[];
  cityIds: string[];
  allies: string[];
  enemies: string[];
  memory: { eventId: string; kind: string; otherCivId?: string; tick: number }[];
  contributionId?: string;
}

export interface WarState {
  id: string;
  a: string;
  b: string;
  tickStarted: number;
  regionId: string;
  intensity: number;
}

export interface TradeRouteState {
  id: string;
  fromCityId: string;
  toCityId: string;
  resourceId: string;
  distance: number;
  risk: number;
}

export interface DiseaseState {
  id: string;
  name: string;
  nameAr: string;
  infectivity: number;
  lethality: number;
  regionIds: string[];
  contributionId?: string;
}

export interface RegionRuntime {
  id: string;
  biome: BiomeType;
  lat: number;
  lon: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  population: number;
  pollution: number;
  civilizationId: string | null;
  carryingCapacity: number;
}

export interface WorldState {
  seed: string;
  tick: number;
  year: number;
  regions: Map<string, RegionRuntime>;
  species: Map<string, SpeciesState>;
  plants: Map<string, PlantState>;
  resources: Map<string, ResourceState>;
  civilizations: Map<string, CivilizationState>;
  cities: Map<string, CityState>;
  wars: Map<string, WarState>;
  tradeRoutes: Map<string, TradeRouteState>;
  diseases: Map<string, DiseaseState>;
  technologies: Map<string, { id: string; name: string; nameAr: string; level: number; civIds: string[] }>;
}

export interface TickResult {
  tick: number;
  year: number;
  events: SimEvent[];
  deltas: { entity: string; id: string; patch: Record<string, unknown> }[];
}

export interface WorldSnapshot {
  state: ReturnType<typeof serializeWorld>;
  events: ReturnType<EventStore["snapshot"]>;
  rngState: number;
}

function serializeWorld(state: WorldState) {
  return structuredClone({
    seed: state.seed,
    tick: state.tick,
    year: state.year,
    regions: [...state.regions.entries()],
    species: [...state.species.entries()],
    plants: [...state.plants.entries()],
    resources: [...state.resources.entries()],
    civilizations: [...state.civilizations.entries()],
    cities: [...state.cities.entries()],
    wars: [...state.wars.entries()],
    tradeRoutes: [...state.tradeRoutes.entries()],
    diseases: [...state.diseases.entries()],
    technologies: [...state.technologies.entries()],
  });
}

function deserializeWorld(data: ReturnType<typeof serializeWorld>): WorldState {
  return {
    seed: data.seed,
    tick: data.tick,
    year: data.year,
    regions: new Map(data.regions),
    species: new Map(data.species),
    plants: new Map(data.plants),
    resources: new Map(data.resources),
    civilizations: new Map(data.civilizations),
    cities: new Map(data.cities),
    wars: new Map(data.wars),
    tradeRoutes: new Map(data.tradeRoutes),
    diseases: new Map(data.diseases),
    technologies: new Map(data.technologies),
  };
}

export class SimulationEngine {
  readonly events = new EventStore();
  private rng: SeededRandom;
  state: WorldState;
  private snapshots = new Map<number, WorldSnapshot>();

  constructor(seed: string, regions: GeneratedRegion[], startYear = -1000) {
    this.rng = new SeededRandom(seed);
    this.state = {
      seed,
      tick: 0,
      year: startYear,
      regions: new Map(
        regions.map((r) => [
          r.id,
          {
            id: r.id,
            biome: r.biome,
            lat: r.lat,
            lon: r.lon,
            elevation: r.elevation,
            temperature: r.temperature,
            moisture: r.moisture,
            fertility: r.fertility,
            population: 0,
            pollution: 0,
            civilizationId: null,
            carryingCapacity: Math.floor(500 + r.fertility * 4500),
          } satisfies RegionRuntime,
        ]),
      ),
      species: new Map(),
      plants: new Map(),
      resources: new Map(),
      civilizations: new Map(),
      cities: new Map(),
      wars: new Map(),
      tradeRoutes: new Map(),
      diseases: new Map(),
      technologies: new Map(),
    };
  }

  getRng(): SeededRandom {
    return this.rng;
  }

  takeSnapshot(): WorldSnapshot {
    const snap: WorldSnapshot = {
      state: serializeWorld(this.state),
      events: this.events.snapshot(),
      rngState: this.rng.getState(),
    };
    this.snapshots.set(this.state.tick, snap);
    return snap;
  }

  rollbackTo(tick: number): boolean {
    const snap = this.snapshots.get(tick);
    if (!snap) return false;
    this.state = deserializeWorld(snap.state);
    this.events.restore(snap.events);
    this.rng.setState(snap.rngState);
    return true;
  }

  /** Bootstrap a living world for demo/seed */
  bootstrapInitialWorld(opts?: {
    civilizations?: number;
    citiesPerCiv?: number;
    species?: number;
    plants?: number;
    resources?: number;
    technologies?: number;
  }): SimEvent[] {
    const civCount = opts?.civilizations ?? 12;
    const citiesPerCiv = opts?.citiesPerCiv ?? 3;
    const speciesCount = opts?.species ?? 40;
    const plantCount = opts?.plants ?? 60;
    const resourceCount = opts?.resources ?? 120;
    const techCount = opts?.technologies ?? 50;

    const land = [...this.state.regions.values()].filter(
      (r) => r.biome !== "ocean" && r.biome !== "ice",
    );
    const shuffled = this.rng.shuffle(land);
    const bootstrapEvents: SimEvent[] = [];

    // Plants
    for (let i = 0; i < plantCount; i++) {
      const region = shuffled[i % shuffled.length]!;
      const id = `plant_${i.toString().padStart(3, "0")}`;
      const plant: PlantState = {
        id,
        name: `Flora ${i + 1}`,
        nameAr: `نبات ${i + 1}`,
        coverage: this.rng.float(0.1, 0.8),
        traits: {
          size: this.rng.float(0.1, 0.9),
          growthRate: this.rng.float(0.2, 0.8),
          waterNeed: this.rng.float(0.2, 0.9),
          coldResistance: this.rng.float(),
          heatResistance: this.rng.float(),
        },
        biomes: [region.biome],
        regionIds: [region.id],
      };
      this.state.plants.set(id, plant);
    }

    // Species
    for (let i = 0; i < speciesCount; i++) {
      const region = shuffled[(i * 3) % shuffled.length]!;
      const id = `sp_${i.toString().padStart(3, "0")}`;
      const trophic = this.rng.int(1, 2);
      const sp: SpeciesState = {
        id,
        name: `Species ${i + 1}`,
        nameAr: `مخلوق ${i + 1}`,
        population: this.rng.int(50, 5000),
        traits: {
          size: this.rng.float(0.1, 0.95),
          reproduction: this.rng.float(0.15, 0.85),
          intelligence: this.rng.float(),
          aggression: this.rng.float(),
          adaptability: this.rng.float(0.2, 0.9),
          coldResistance: this.rng.float(),
          heatResistance: this.rng.float(),
          waterNeed: this.rng.float(0.2, 0.9),
        },
        biomes: [region.biome],
        regionIds: [region.id],
        trophicLevel: trophic,
      };
      this.state.species.set(id, sp);
    }

    // Resources
    const resourceKinds = [
      ["Iron", "حديد"],
      ["Copper", "نحاس"],
      ["Timber", "أخشاب"],
      ["Grain", "حبوب"],
      ["Fish", "أسماك"],
      ["Oil", "نفط"],
      ["Crystal", "بلور"],
      ["Herbs", "أعشاب"],
    ] as const;
    for (let i = 0; i < resourceCount; i++) {
      const region = shuffled[(i * 7) % shuffled.length]!;
      const kind = resourceKinds[i % resourceKinds.length]!;
      const id = `res_${i.toString().padStart(3, "0")}`;
      this.state.resources.set(id, {
        id,
        name: `${kind[0]} Deposit ${i + 1}`,
        nameAr: `مورد ${kind[1]} ${i + 1}`,
        quantity: this.rng.int(100, 10000),
        renewRate: this.rng.float(0, 0.05),
        value: this.rng.float(0.2, 1),
        regionId: region.id,
        controllerCivId: null,
      });
    }

    // Civilizations + cities
    const civNames = [
      ["Aurora Realm", "مملكة الشفق"],
      ["Tide Confederation", "اتحاد المد"],
      ["Stone Empire", "إمبراطورية الصخر"],
      ["Verdant Tribes", "قبائل الخضرة"],
      ["Sunward League", "رابطة الشمس"],
      ["Mist Clans", "عشائر الضباب"],
      ["Iron Republic", "جمهورية الحديد"],
      ["River Kingdoms", "ممالك النهر"],
      ["Sky Nomads", "بدو السماء"],
      ["Coral Cities", "مدن المرجان"],
      ["Ash Dominion", "سيادة الرماد"],
      ["Crystal Court", "بلاط البلور"],
    ];

    for (let i = 0; i < civCount; i++) {
      const home = shuffled[i % shuffled.length]!;
      const names = civNames[i % civNames.length]!;
      const civId = `civ_${i.toString().padStart(2, "0")}`;
      const cityIds: string[] = [];
      let pop = 0;
      for (let c = 0; c < citiesPerCiv; c++) {
        const region = shuffled[(i * citiesPerCiv + c) % shuffled.length]!;
        const cityId = `city_${i}_${c}`;
        const cityPop = this.rng.int(2000, 25000);
        pop += cityPop;
        this.state.cities.set(cityId, {
          id: cityId,
          name: `${names[0]} City ${c + 1}`,
          nameAr: `مدينة ${names[1]} ${c + 1}`,
          regionId: region.id,
          population: cityPop,
          civilizationId: civId,
        });
        cityIds.push(cityId);
        region.population += cityPop;
        region.civilizationId = civId;
      }
      const civ: CivilizationState = {
        id: civId,
        name: names[0],
        nameAr: names[1],
        population: pop,
        techLevel: this.rng.float(0.1, 0.6),
        military: this.rng.float(0.1, 0.7),
        economy: this.rng.float(0.2, 0.8),
        food: this.rng.float(0.3, 0.9),
        stability: this.rng.float(0.4, 0.95),
        aggression: this.rng.float(0.1, 0.7),
        happiness: this.rng.float(0.3, 0.9).toFixed(2),
        education: this.rng.float(0.1, 0.7),
        pollution: this.rng.float(0, 0.3),
        government: this.rng.pick([
          "monarchy",
          "republic",
          "tribal",
          "theocracy",
          "oligarchy",
        ]),
        culture: `Culture ${i + 1}`,
        language: `Lang ${i + 1}`,
        regionIds: cityIds.map((id) => this.state.cities.get(id)!.regionId),
        cityIds,
        allies: [],
        enemies: [],
        memory: [],
      };
      this.state.civilizations.set(civId, civ);

      const ev: SimEvent = {
        id: makeEventId("boot"),
        type: "CIVILIZATION_FOUNDED",
        tick: 0,
        year: this.state.year,
        regionId: home.id,
        title: `${civ.name} founded`,
        titleAr: `تأسيس ${civ.nameAr}`,
        description: `A civilization rises in ${home.biome} lands.`,
        descriptionAr: `نهضت حضارة في أراضي ${home.biome}.`,
        importance: 0.85,
        cause: "world_bootstrap",
        relatedEntityIds: [civId],
        directImpact: { population: pop },
        confidence: 1,
        metadata: {},
      };
      this.events.append(ev);
      bootstrapEvents.push(ev);
    }

    // Assign some resources to civs
    let ri = 0;
    for (const res of this.state.resources.values()) {
      const civ = [...this.state.civilizations.values()][ri % civCount];
      if (civ) {
        res.controllerCivId = civ.id;
        ri++;
      }
    }

    // Technologies
    for (let i = 0; i < techCount; i++) {
      const id = `tech_${i.toString().padStart(2, "0")}`;
      const holders = this.rng
        .shuffle([...this.state.civilizations.keys()])
        .slice(0, this.rng.int(1, 4));
      this.state.technologies.set(id, {
        id,
        name: `Technology ${i + 1}`,
        nameAr: `تقنية ${i + 1}`,
        level: this.rng.float(0.1, 0.9),
        civIds: holders,
      });
    }

    // Initial alliances
    const civIds = [...this.state.civilizations.keys()];
    for (let i = 0; i < Math.min(4, Math.floor(civIds.length / 2)); i++) {
      const a = civIds[i * 2]!;
      const b = civIds[i * 2 + 1]!;
      this.state.civilizations.get(a)!.allies.push(b);
      this.state.civilizations.get(b)!.allies.push(a);
      const ev: SimEvent = {
        id: makeEventId("ally"),
        type: "ALLIANCE_CREATED",
        tick: 0,
        year: this.state.year,
        regionId: null,
        title: `Alliance: ${this.state.civilizations.get(a)!.name} ↔ ${this.state.civilizations.get(b)!.name}`,
        titleAr: `تحالف: ${this.state.civilizations.get(a)!.nameAr} ↔ ${this.state.civilizations.get(b)!.nameAr}`,
        description: "Two civilizations form a mutual alliance.",
        descriptionAr: "تشكلت حضارتان تحالفًا متبادلًا.",
        importance: 0.6,
        cause: "mutual_interest",
        relatedEntityIds: [a, b],
        directImpact: { stability: 0.05 },
        confidence: 1,
        metadata: {},
      };
      this.events.append(ev);
      bootstrapEvents.push(ev);
    }

    this.takeSnapshot();
    return bootstrapEvents;
  }

  tick(yearsPerTick = 1): TickResult {
    this.state.tick += 1;
    this.state.year += yearsPerTick;
    const tickEvents: SimEvent[] = [];
    const deltas: TickResult["deltas"] = [];
    const tickRng = this.rng.fork(`tick:${this.state.tick}`);

    // Climate drift (small, deterministic)
    for (const region of this.state.regions.values()) {
      if (region.biome === "ocean") continue;
      const dTemp = (tickRng.float() - 0.5) * 0.01;
      const dMoist = (tickRng.float() - 0.5) * 0.01;
      region.temperature = clamp01(region.temperature + dTemp);
      region.moisture = clamp01(region.moisture + dMoist);
      // Pollution cools fertility
      region.fertility = clamp01(
        region.fertility - region.pollution * 0.002 + dMoist * 0.1,
      );
    }

    // Ecology: plants grow, species Lotka-Volterra-inspired
    this.stepEcology(tickRng, tickEvents);

    // Civilizations: utility decisions
    this.stepCivilizations(tickRng, tickEvents, deltas);

    // Wars
    this.stepWars(tickRng, tickEvents, deltas);

    // Economy / trade
    this.stepEconomy(tickRng, tickEvents);

    // Diseases
    this.stepDiseases(tickRng, tickEvents);

    // Occasional climate events
    if (tickRng.bool(0.08)) {
      const land = [...this.state.regions.values()].filter((r) => r.biome !== "ocean");
      const region = tickRng.pick(land);
      const dry = region.moisture < 0.35;
      const ev: SimEvent = {
        id: makeEventId("clim"),
        type: dry ? "DROUGHT" : "CLIMATE_CHANGED",
        tick: this.state.tick,
        year: this.state.year,
        regionId: region.id,
        title: dry ? `Drought in region` : `Climate shift`,
        titleAr: dry ? `جفاف في المنطقة` : `تغير مناخي`,
        description: dry
          ? `Moisture fell; crops and migration pressure rise.`
          : `Temperature and moisture patterns shift.`,
        descriptionAr: dry
          ? `انخفضت الرطوبة؛ زاد الضغط على المحاصيل والهجرة.`
          : `تغيرت أنماط الحرارة والرطوبة.`,
        importance: dry ? 0.7 : 0.45,
        cause: "climate_model",
        relatedEntityIds: [region.id],
        directImpact: {
          moisture: dry ? -0.08 : 0.02,
          fertility: dry ? -0.05 : 0,
        },
        confidence: 0.9,
        metadata: {},
      };
      if (dry) region.moisture = clamp01(region.moisture - 0.08);
      this.events.append(ev);
      tickEvents.push(ev);
    }

    // Snapshot every 10 ticks
    if (this.state.tick % 10 === 0) this.takeSnapshot();

    return {
      tick: this.state.tick,
      year: this.state.year,
      events: tickEvents,
      deltas,
    };
  }

  private stepEcology(rng: SeededRandom, events: SimEvent[]): void {
    // Plant coverage growth limited by moisture & fertility
    for (const plant of this.state.plants.values()) {
      const growth = (plant.traits.growthRate ?? 0.3) * 0.05;
      const water = plant.traits.waterNeed ?? 0.5;
      let factor = 1;
      for (const rid of plant.regionIds) {
        const r = this.state.regions.get(rid);
        if (!r) continue;
        factor *= clamp01(1.2 - Math.abs(r.moisture - water));
        factor *= 0.7 + r.fertility * 0.3;
      }
      plant.coverage = clamp01(plant.coverage + growth * factor - 0.01);
    }

    // Species populations
    const herbivores = [...this.state.species.values()].filter((s) => s.trophicLevel === 1);
    const carnivores = [...this.state.species.values()].filter((s) => s.trophicLevel === 2);
    const plantBiomass =
      [...this.state.plants.values()].reduce((a, p) => a + p.coverage, 0) /
      Math.max(1, this.state.plants.size);

    for (const h of herbivores) {
      const repro = h.traits.reproduction ?? 0.4;
      const carrying = 2000 + plantBiomass * 8000;
      const growth = repro * h.population * (1 - h.population / carrying);
      const predation = carnivores.reduce((a, c) => {
        const overlap = c.regionIds.some((r) => h.regionIds.includes(r));
        return a + (overlap ? c.population * 0.002 * (c.traits.aggression ?? 0.5) : 0);
      }, 0);
      h.population = Math.max(0, Math.floor(h.population + growth - predation));
      if (h.population === 0 && rng.bool(0.3)) {
        const ev = this.emitExtinction(h);
        events.push(ev);
      }
    }

    for (const c of carnivores) {
      const prey = herbivores
        .filter((h) => h.regionIds.some((r) => c.regionIds.includes(r)))
        .reduce((a, h) => a + h.population, 0);
      const repro = (c.traits.reproduction ?? 0.3) * 0.5;
      const foodFactor = Math.min(1.5, prey / Math.max(1, c.population * 10));
      c.population = Math.max(
        0,
        Math.floor(c.population + repro * c.population * foodFactor - c.population * 0.08),
      );
      if (c.population === 0 && rng.bool(0.25)) {
        events.push(this.emitExtinction(c));
      }
    }

    // Mutation rare
    if (rng.bool(0.05) && this.state.species.size > 0) {
      const sp = rng.pick([...this.state.species.values()]);
      const trait = rng.pick(Object.keys(sp.traits));
      const before = sp.traits[trait] ?? 0.5;
      sp.traits[trait] = clamp01(before + rng.float(-0.1, 0.1));
      const ev: SimEvent = {
        id: makeEventId("mut"),
        type: "SPECIES_MUTATED",
        tick: this.state.tick,
        year: this.state.year,
        regionId: sp.regionIds[0] ?? null,
        title: `${sp.name} mutated`,
        titleAr: `طفرة في ${sp.nameAr}`,
        description: `Trait ${trait} shifted under selection pressure.`,
        descriptionAr: `تغيرت صفة ${trait} تحت ضغط الانتقاء.`,
        importance: 0.4,
        cause: "natural_selection",
        relatedEntityIds: [sp.id],
        directImpact: { [trait]: (sp.traits[trait] ?? 0) - before },
        confidence: 0.85,
        metadata: { trait },
      };
      this.events.append(ev);
      events.push(ev);
    }
  }

  private emitExtinction(sp: SpeciesState): SimEvent {
    this.state.species.delete(sp.id);
    const ev: SimEvent = {
      id: makeEventId("ext"),
      type: "SPECIES_EXTINCT",
      tick: this.state.tick,
      year: this.state.year,
      regionId: sp.regionIds[0] ?? null,
      title: `${sp.name} extinct`,
      titleAr: `انقراض ${sp.nameAr}`,
      description: `Population reached zero due to predation/competition.`,
      descriptionAr: `وصل التعداد إلى الصفر بسبب الافتراس/التنافس.`,
      importance: 0.8,
      cause: "population_collapse",
      relatedEntityIds: [sp.id],
      contributionId: sp.contributionId ?? null,
      directImpact: { biodiversity: -1 },
      confidence: 1,
      metadata: {},
    };
    this.events.append(ev);
    return ev;
  }

  private stepCivilizations(
    rng: SeededRandom,
    events: SimEvent[],
    deltas: TickResult["deltas"],
  ): void {
    for (const civ of this.state.civilizations.values()) {
      // Food from fertility & plants
      const fertilityAvg =
        civ.regionIds.reduce((a, id) => a + (this.state.regions.get(id)?.fertility ?? 0), 0) /
        Math.max(1, civ.regionIds.length);
      civ.food = clamp01(civ.food * 0.9 + fertilityAvg * 0.15);
      // Population growth limited by food & carrying capacity
      const cap = civ.regionIds.reduce(
        (a, id) => a + (this.state.regions.get(id)?.carryingCapacity ?? 1000),
        0,
      );
      const growthRate = (civ.food - 0.4) * 0.02 * (1 - civ.population / Math.max(1, cap));
      const prev = civ.population;
      civ.population = Math.max(100, Math.floor(civ.population * (1 + growthRate)));
      // Pollution from economy/tech
      civ.pollution = clamp01(civ.pollution + civ.economy * 0.005 + civ.techLevel * 0.002 - 0.004);
      for (const rid of civ.regionIds) {
        const r = this.state.regions.get(rid);
        if (r) r.pollution = clamp01((r.pollution + civ.pollution) / 2);
      }

      // Utility AI decision
      const utilities = this.computeUtilities(civ);
      const action = Object.entries(utilities).sort((a, b) => b[1] - a[1])[0];
      if (!action) continue;
      const [act, score] = action;
      if (score < 0.35) continue;

      if (act === "research" && rng.bool(0.4)) {
        civ.techLevel = clamp01(civ.techLevel + 0.02);
        const techId = `tech_dyn_${this.state.tick}_${civ.id}`;
        this.state.technologies.set(techId, {
          id: techId,
          name: `Discovery ${this.state.tick}`,
          nameAr: `اكتشاف ${this.state.tick}`,
          level: civ.techLevel,
          civIds: [civ.id],
        });
        const ev: SimEvent = {
          id: makeEventId("tech"),
          type: "TECHNOLOGY_DISCOVERED",
          tick: this.state.tick,
          year: this.state.year,
          regionId: civ.regionIds[0] ?? null,
          title: `${civ.name} discovered technology`,
          titleAr: `${civ.nameAr} اكتشفت تقنية`,
          description: `Research investment yielded a new capability.`,
          descriptionAr: `أسفر الاستثمار في البحث عن قدرة جديدة.`,
          importance: 0.65,
          cause: "research_investment",
          relatedEntityIds: [civ.id, techId],
          directImpact: { techLevel: 0.02 },
          confidence: 0.9,
          metadata: { action: act },
        };
        this.events.append(ev);
        events.push(ev);
      }

      if (act === "expand" && rng.bool(0.25)) {
        const candidates = [...this.state.regions.values()].filter(
          (r) => !r.civilizationId && r.biome !== "ocean" && r.biome !== "ice",
        );
        if (candidates.length) {
          const target = rng.pick(candidates);
          const cityId = `city_exp_${this.state.tick}_${civ.id}`;
          const cityPop = Math.min(5000, Math.floor(civ.population * 0.05));
          this.state.cities.set(cityId, {
            id: cityId,
            name: `${civ.name} Outpost`,
            nameAr: `مستوطنة ${civ.nameAr}`,
            regionId: target.id,
            population: cityPop,
            civilizationId: civ.id,
          });
          civ.cityIds.push(cityId);
          civ.regionIds.push(target.id);
          target.civilizationId = civ.id;
          target.population = cityPop;
          const ev: SimEvent = {
            id: makeEventId("city"),
            type: "CITY_CREATED",
            tick: this.state.tick,
            year: this.state.year,
            regionId: target.id,
            title: `${civ.name} founded a city`,
            titleAr: `${civ.nameAr} أسست مدينة`,
            description: `Expansion into new fertile lands.`,
            descriptionAr: `توسع نحو أراضٍ خصبة جديدة.`,
            importance: 0.7,
            cause: "expansion_drive",
            relatedEntityIds: [civ.id, cityId],
            directImpact: { population: cityPop },
            confidence: 0.95,
            metadata: {},
          };
          this.events.append(ev);
          events.push(ev);
        }
      }

      if (act === "war" && rng.bool(0.15)) {
        this.maybeStartWar(civ, rng, events);
      }

      if (act === "ally" && rng.bool(0.2)) {
        const others = [...this.state.civilizations.values()].filter(
          (o) =>
            o.id !== civ.id &&
            !civ.allies.includes(o.id) &&
            !civ.enemies.includes(o.id),
        );
        if (others.length) {
          const other = rng.pick(others);
          civ.allies.push(other.id);
          other.allies.push(civ.id);
          const ev: SimEvent = {
            id: makeEventId("ally"),
            type: "ALLIANCE_CREATED",
            tick: this.state.tick,
            year: this.state.year,
            regionId: null,
            title: `Alliance ${civ.name} ↔ ${other.name}`,
            titleAr: `تحالف ${civ.nameAr} ↔ ${other.nameAr}`,
            description: "Diplomacy formed for mutual security.",
            descriptionAr: "تشكل تحالف دبلوماسي للأمن المتبادل.",
            importance: 0.55,
            cause: "diplomatic_utility",
            relatedEntityIds: [civ.id, other.id],
            directImpact: { stability: 0.03 },
            confidence: 0.9,
            metadata: {},
          };
          this.events.append(ev);
          events.push(ev);
        }
      }

      if (act === "migrate" && civ.food < 0.35 && rng.bool(0.3)) {
        const target = rng.pick(
          [...this.state.regions.values()].filter((r) => r.biome !== "ocean"),
        );
        const migrants = Math.floor(civ.population * 0.08);
        civ.population -= migrants;
        target.population += migrants;
        const ev: SimEvent = {
          id: makeEventId("mig"),
          type: "MIGRATION_STARTED",
          tick: this.state.tick,
          year: this.state.year,
          regionId: target.id,
          title: `Migration from ${civ.name}`,
          titleAr: `هجرة من ${civ.nameAr}`,
          description: `Food scarcity drives ${migrants} people to migrate.`,
          descriptionAr: `ندرة الغذاء تدفع ${migrants} شخصًا للهجرة.`,
          importance: 0.6,
          cause: "food_scarcity",
          relatedEntityIds: [civ.id, target.id],
          directImpact: { migrants },
          confidence: 0.9,
          metadata: {},
        };
        this.events.append(ev);
        events.push(ev);
      }

      deltas.push({
        entity: "civilization",
        id: civ.id,
        patch: {
          population: civ.population,
          food: civ.food,
          techLevel: civ.techLevel,
          pollution: civ.pollution,
          deltaPop: civ.population - prev,
        },
      });
    }
  }

  private computeUtilities(civ: CivilizationState): Record<string, number> {
    const threat = civ.enemies.length * 0.15 + civ.aggression * 0.2;
    return {
      research: civ.education * 0.4 + (1 - civ.techLevel) * 0.3 + civ.economy * 0.2,
      expand: civ.food * 0.35 + (1 - civ.stability) * 0.1 + civ.population / 100000,
      war: threat + (1 - civ.food) * 0.25 + civ.military * 0.3 - civ.allies.length * 0.05,
      ally: (1 - civ.stability) * 0.3 + threat * 0.4 + (1 - civ.military) * 0.2,
      migrate: (1 - civ.food) * 0.7 + civ.pollution * 0.2,
      trade: civ.economy * 0.4 + civ.food * 0.2,
    };
  }

  private warProbability(a: CivilizationState, b: CivilizationState): number {
    const sharedRes = [...this.state.resources.values()].filter(
      (r) => r.controllerCivId === a.id || r.controllerCivId === b.id,
    ).length;
    const historyPenalty = a.memory.filter(
      (m) => m.otherCivId === b.id && m.kind === "attacked_by",
    ).length * 0.15;
    const geo =
      a.regionIds.some((r) => {
        const ra = this.state.regions.get(r);
        return b.regionIds.some((br) => {
          const rb = this.state.regions.get(br);
          if (!ra || !rb) return false;
          const d = Math.hypot(ra.lat - rb.lat, ra.lon - rb.lon);
          return d < 0.35;
        });
      })
        ? 0.25
        : 0.05;
    const imbalance = Math.abs(a.military - b.military);
    const foodStress = Math.max(0, 0.4 - a.food) + Math.max(0, 0.4 - b.food);
    let p =
      0.05 +
      a.aggression * 0.2 +
      geo +
      foodStress * 0.2 +
      historyPenalty +
      (sharedRes > 5 ? 0.1 : 0) -
      (a.allies.includes(b.id) ? 0.5 : 0) -
      imbalance * 0.05;
    return clamp01(p);
  }

  private maybeStartWar(civ: CivilizationState, rng: SeededRandom, events: SimEvent[]): void {
    const others = [...this.state.civilizations.values()].filter(
      (o) => o.id !== civ.id && !civ.allies.includes(o.id),
    );
    for (const other of rng.shuffle(others).slice(0, 3)) {
      const p = this.warProbability(civ, other);
      if (!rng.bool(p)) continue;
      // Already at war?
      const existing = [...this.state.wars.values()].find(
        (w) =>
          (w.a === civ.id && w.b === other.id) || (w.a === other.id && w.b === civ.id),
      );
      if (existing) continue;
      const warId = `war_${this.state.tick}_${civ.id}_${other.id}`;
      const regionId = civ.regionIds[0] ?? other.regionIds[0] ?? null;
      this.state.wars.set(warId, {
        id: warId,
        a: civ.id,
        b: other.id,
        tickStarted: this.state.tick,
        regionId: regionId ?? "unknown",
        intensity: 0.4 + rng.float() * 0.4,
      });
      if (!civ.enemies.includes(other.id)) civ.enemies.push(other.id);
      if (!other.enemies.includes(civ.id)) other.enemies.push(civ.id);
      other.memory.push({
        eventId: warId,
        kind: "attacked_by",
        otherCivId: civ.id,
        tick: this.state.tick,
      });
      const ev: SimEvent = {
        id: makeEventId("war"),
        type: "WAR_STARTED",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `War: ${civ.name} vs ${other.name}`,
        titleAr: `حرب: ${civ.nameAr} ضد ${other.nameAr}`,
        description: `Conflict probability ${(p * 100).toFixed(0)}% realized from resources, proximity, and aggression.`,
        descriptionAr: `تحققت احتمالية نزاع ${(p * 100).toFixed(0)}% بسبب الموارد والقرب والعدوانية.`,
        importance: 0.9,
        cause: "war_probability_model",
        relatedEntityIds: [civ.id, other.id, warId],
        directImpact: { stability: -0.1 },
        confidence: 0.85,
        metadata: { probability: p },
      };
      this.events.append(ev);
      events.push(ev);
      break;
    }
  }

  private stepWars(rng: SeededRandom, events: SimEvent[], deltas: TickResult["deltas"]): void {
    for (const war of [...this.state.wars.values()]) {
      const a = this.state.civilizations.get(war.a);
      const b = this.state.civilizations.get(war.b);
      if (!a || !b) {
        this.state.wars.delete(war.id);
        continue;
      }
      const terrain = this.state.regions.get(war.regionId);
      const terrainMod = terrain?.elevation && terrain.elevation > 0.7 ? 0.85 : 1;
      const powerA = a.military * a.techLevel * (a.food + 0.2) * terrainMod;
      const powerB = b.military * b.techLevel * (b.food + 0.2);
      const lossA = Math.floor(a.population * 0.01 * war.intensity * (powerB / (powerA + 0.01)));
      const lossB = Math.floor(b.population * 0.01 * war.intensity * (powerA / (powerB + 0.01)));
      a.population = Math.max(50, a.population - lossA);
      b.population = Math.max(50, b.population - lossB);
      a.stability = clamp01(a.stability - 0.02);
      b.stability = clamp01(b.stability - 0.02);
      a.economy = clamp01(a.economy - 0.01);
      b.economy = clamp01(b.economy - 0.01);
      // Tech spur from war
      if (rng.bool(0.2)) {
        a.techLevel = clamp01(a.techLevel + 0.01);
        b.techLevel = clamp01(b.techLevel + 0.01);
      }
      war.intensity = clamp01(war.intensity + rng.float(-0.05, 0.05));

      const duration = this.state.tick - war.tickStarted;
      if (duration > 5 && (rng.bool(0.25) || a.stability < 0.2 || b.stability < 0.2)) {
        this.state.wars.delete(war.id);
        const winner = powerA >= powerB ? a : b;
        const loser = winner.id === a.id ? b : a;
        // Border change: transfer one city
        const loserCityId = loser.cityIds[loser.cityIds.length - 1];
        if (loserCityId && loser.cityIds.length > 1) {
          const city = this.state.cities.get(loserCityId);
          if (city) {
            city.civilizationId = winner.id;
            winner.cityIds.push(city.id);
            loser.cityIds = loser.cityIds.filter((id) => id !== city.id);
            const region = this.state.regions.get(city.regionId);
            if (region) region.civilizationId = winner.id;
          }
        }
        const ev: SimEvent = {
          id: makeEventId("warend"),
          type: "WAR_ENDED",
          tick: this.state.tick,
          year: this.state.year,
          regionId: war.regionId,
          title: `War ended — ${winner.name} prevails`,
          titleAr: `انتهت الحرب — انتصار ${winner.nameAr}`,
          description: `Casualties A/B: ${lossA}/${lossB}. Borders and treaties shift.`,
          descriptionAr: `خسائر الطرفين: ${lossA}/${lossB}. تغيرت الحدود والمعاهدات.`,
          importance: 0.85,
          cause: war.id,
          relatedEntityIds: [a.id, b.id, war.id],
          directImpact: { lossA, lossB },
          confidence: 0.9,
          metadata: { winnerId: winner.id },
        };
        this.events.append(ev, {
          eventId: war.id,
          relation: "resolves",
          strength: 1,
          delayTicks: duration,
        });
        events.push(ev);
      }

      deltas.push({
        entity: "war",
        id: war.id,
        patch: { intensity: war.intensity, lossA, lossB },
      });
    }
  }

  private stepEconomy(rng: SeededRandom, events: SimEvent[]): void {
    // Renew / deplete resources
    for (const res of this.state.resources.values()) {
      res.quantity = Math.max(0, res.quantity * (1 - 0.01) + res.quantity * res.renewRate);
      if (res.quantity < 10 && rng.bool(0.3)) {
        const ev: SimEvent = {
          id: makeEventId("dep"),
          type: "RESOURCE_DEPLETED",
          tick: this.state.tick,
          year: this.state.year,
          regionId: res.regionId,
          title: `${res.name} nearly depleted`,
          titleAr: `${res.nameAr} أوشك على النضوب`,
          description: "Extraction exceeded renewal rate.",
          descriptionAr: "الاستخراج تجاوز معدل التجدد.",
          importance: 0.55,
          cause: "overextraction",
          relatedEntityIds: [res.id],
          contributionId: res.contributionId ?? null,
          directImpact: { quantity: -res.quantity },
          confidence: 1,
          metadata: {},
        };
        this.events.append(ev);
        events.push(ev);
      }
    }

    // Create trade routes via simple distance heuristic (Dijkstra-ready graph)
    if (rng.bool(0.1) && this.state.cities.size >= 2) {
      const cities = [...this.state.cities.values()];
      const from = rng.pick(cities);
      const to = rng.pick(cities.filter((c) => c.id !== from.id));
      const fromR = this.state.regions.get(from.regionId);
      const toR = this.state.regions.get(to.regionId);
      if (fromR && toR) {
        const distance = Math.hypot(fromR.lat - toR.lat, fromR.lon - toR.lon);
        const path = this.shortestPath(from.regionId, to.regionId);
        const risk = path ? path.risk : 0.8;
        const res = [...this.state.resources.values()].find(
          (r) => r.regionId === from.regionId,
        );
        if (res && path) {
          const id = `trade_${this.state.tick}_${from.id}_${to.id}`;
          if (![...this.state.tradeRoutes.values()].some((t) => t.fromCityId === from.id && t.toCityId === to.id)) {
            this.state.tradeRoutes.set(id, {
              id,
              fromCityId: from.id,
              toCityId: to.id,
              resourceId: res.id,
              distance,
              risk,
            });
            const fa = this.state.civilizations.get(from.civilizationId);
            const tb = this.state.civilizations.get(to.civilizationId);
            if (fa) fa.economy = clamp01(fa.economy + 0.02);
            if (tb) tb.economy = clamp01(tb.economy + 0.015);
            const ev: SimEvent = {
              id: makeEventId("trade"),
              type: "TRADE_ROUTE_CREATED",
              tick: this.state.tick,
              year: this.state.year,
              regionId: from.regionId,
              title: `Trade route established`,
              titleAr: `تأسس طريق تجاري`,
              description: `Route length ${distance.toFixed(2)}, risk ${risk.toFixed(2)}.`,
              descriptionAr: `طول الطريق ${distance.toFixed(2)}، المخاطرة ${risk.toFixed(2)}.`,
              importance: 0.5,
              cause: "economic_opportunity",
              relatedEntityIds: [from.id, to.id, res.id],
              directImpact: { economy: 0.02 },
              confidence: 0.9,
              metadata: { path: path.nodes },
            };
            this.events.append(ev);
            events.push(ev);
          }
        }
      }
    }
  }

  /** Dijkstra on region adjacency (lat/lon neighbors) */
  shortestPath(
    fromId: string,
    toId: string,
  ): { nodes: string[]; cost: number; risk: number } | null {
    const regions = [...this.state.regions.values()];
    const byId = this.state.regions;
    const adj = new Map<string, { id: string; w: number }[]>();
    for (const a of regions) {
      const edges: { id: string; w: number }[] = [];
      for (const b of regions) {
        if (a.id === b.id) continue;
        const d = Math.hypot(a.lat - b.lat, a.lon - b.lon);
        if (d < 0.25) {
          const warRisk = [...this.state.wars.values()].some(
            (w) => w.regionId === a.id || w.regionId === b.id,
          )
            ? 0.4
            : 0;
          const biomePenalty =
            a.biome === "mountain" || b.biome === "mountain" ? 0.3 : 0;
          edges.push({ id: b.id, w: d + warRisk + biomePenalty });
        }
      }
      adj.set(a.id, edges);
    }

    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const pq: { id: string; d: number }[] = [];
    for (const r of regions) {
      dist.set(r.id, Infinity);
      prev.set(r.id, null);
    }
    dist.set(fromId, 0);
    pq.push({ id: fromId, d: 0 });
    while (pq.length) {
      pq.sort((a, b) => a.d - b.d);
      const cur = pq.shift()!;
      if (cur.id === toId) break;
      if (cur.d > (dist.get(cur.id) ?? Infinity)) continue;
      for (const e of adj.get(cur.id) ?? []) {
        const nd = cur.d + e.w;
        if (nd < (dist.get(e.id) ?? Infinity)) {
          dist.set(e.id, nd);
          prev.set(e.id, cur.id);
          pq.push({ id: e.id, d: nd });
        }
      }
    }
    if ((dist.get(toId) ?? Infinity) === Infinity) return null;
    const nodes: string[] = [];
    let c: string | null = toId;
    while (c) {
      nodes.push(c);
      c = prev.get(c) ?? null;
    }
    nodes.reverse();
    const cost = dist.get(toId) ?? 0;
    const risk = nodes.reduce((a, id) => {
      const r = byId.get(id);
      return a + (r?.pollution ?? 0) * 0.1;
    }, 0) / Math.max(1, nodes.length);
    return { nodes, cost, risk };
  }

  private stepDiseases(rng: SeededRandom, events: SimEvent[]): void {
    for (const d of this.state.diseases.values()) {
      // Spread to neighboring civ regions
      if (rng.bool(d.infectivity * 0.3)) {
        const civs = [...this.state.civilizations.values()];
        const victim = rng.pick(civs);
        const deaths = Math.floor(victim.population * d.lethality * 0.01);
        victim.population = Math.max(50, victim.population - deaths);
        victim.stability = clamp01(victim.stability - 0.03);
        if (!d.regionIds.includes(victim.regionIds[0]!)) {
          d.regionIds.push(victim.regionIds[0]!);
        }
      }
    }
    if (rng.bool(0.03)) {
      const region = rng.pick([...this.state.regions.values()].filter((r) => r.population > 0));
      if (!region) return;
      const id = `dis_${this.state.tick}`;
      this.state.diseases.set(id, {
        id,
        name: `Plague ${this.state.tick}`,
        nameAr: `وباء ${this.state.tick}`,
        infectivity: rng.float(0.2, 0.8),
        lethality: rng.float(0.05, 0.4),
        regionIds: [region.id],
      });
      const ev: SimEvent = {
        id: makeEventId("dis"),
        type: "DISEASE_OUTBREAK",
        tick: this.state.tick,
        year: this.state.year,
        regionId: region.id,
        title: `Disease outbreak`,
        titleAr: `تفشي مرض`,
        description: `An outbreak begins where population density and pollution align.`,
        descriptionAr: `بدأ تفشٍ حيث اجتمع الكثافة السكانية والتلوث.`,
        importance: 0.75,
        cause: "epidemiology_model",
        relatedEntityIds: [id, region.id],
        directImpact: { health: -0.2 },
        confidence: 0.8,
        metadata: {},
      };
      this.events.append(ev);
      events.push(ev);
    }
  }

  /** Apply a user contribution into the world with causal chain */
  applyContribution(
    element: StructuredElement,
    regionId: string,
    contributionId: string,
  ): { events: SimEvent[]; entityId: string } {
    const region = this.state.regions.get(regionId);
    if (!region) throw new Error(`Unknown region ${regionId}`);
    if (!element.possibleBiomes.includes(region.biome) && region.biome !== "coast") {
      // Allow with reduced success — still apply but note risk
    }
    const events: SimEvent[] = [];
    const rootId = makeEventId("contrib");
    const root: SimEvent = {
      id: rootId,
      type: "USER_CONTRIBUTION",
      tick: this.state.tick,
      year: this.state.year,
      regionId,
      title: `User added: ${element.name}`,
      titleAr: `إضافة مستخدم: ${element.nameAr ?? element.name}`,
      description: element.description ?? `A new ${element.category} enters the world.`,
      descriptionAr: element.description ?? `دخل ${element.category} جديد إلى العالم.`,
      importance: 0.95,
      cause: "user_action",
      relatedEntityIds: [contributionId],
      contributionId,
      directImpact: {},
      confidence: 1,
      metadata: { category: element.category, traits: element.traits },
    };
    this.events.append(root);
    events.push(root);

    let entityId = "";
    const cat = element.category as ElementCategory;

    if (cat === "plant") {
      entityId = `plant_u_${contributionId.slice(0, 8)}`;
      this.state.plants.set(entityId, {
        id: entityId,
        name: element.name,
        nameAr: element.nameAr ?? element.name,
        coverage: 0.15,
        traits: element.traits,
        biomes: element.possibleBiomes,
        regionIds: [regionId],
        contributionId,
      });
      const absorb = element.traits.pollutionAbsorption ?? 0;
      if (absorb > 0) {
        region.pollution = clamp01(region.pollution - absorb * 0.1);
      }
      const ev: SimEvent = {
        id: makeEventId("plant"),
        type: "PLANT_CREATED",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `${element.name} takes root`,
        titleAr: `${element.nameAr ?? element.name} تنمو`,
        description: `Plant established; water need ${(element.traits.waterNeed ?? 0.5).toFixed(2)}.`,
        descriptionAr: `استقر النبات؛ احتياج الماء ${(element.traits.waterNeed ?? 0.5).toFixed(2)}.`,
        importance: 0.8,
        cause: rootId,
        relatedEntityIds: [entityId, contributionId],
        contributionId,
        directImpact: {
          coverage: 0.15,
          pollution: -(element.traits.pollutionAbsorption ?? 0) * 0.1,
        },
        confidence: 0.95,
        metadata: {},
      };
      this.events.append(ev, { eventId: rootId, relation: "creates", strength: 1 });
      events.push(ev);

      // Secondary: water competition
      if ((element.traits.waterNeed ?? 0) > 0.6) {
        region.moisture = clamp01(region.moisture - 0.05);
        const civs = [...this.state.civilizations.values()].filter((c) =>
          c.regionIds.includes(regionId),
        );
        if (civs.length >= 1) {
          const sec: SimEvent = {
            id: makeEventId("sec"),
            type: "CLIMATE_CHANGED",
            tick: this.state.tick,
            year: this.state.year,
            regionId,
            title: `Water stress near ${element.name}`,
            titleAr: `ضغط مائي قرب ${element.nameAr ?? element.name}`,
            description: `High water consumption reduces local moisture, pressuring nearby groups.`,
            descriptionAr: `استهلاك الماء المرتفع يخفض الرطوبة ويضغط على الجماعات المجاورة.`,
            importance: 0.55,
            cause: ev.id,
            relatedEntityIds: [entityId, ...civs.map((c) => c.id)],
            contributionId,
            directImpact: { moisture: -0.05 },
            confidence: 0.85,
            metadata: {},
          };
          this.events.append(sec, {
            eventId: ev.id,
            relation: "water_competition",
            strength: 0.7,
            delayTicks: 0,
          });
          events.push(sec);
        }
      }
    } else if (cat === "creature") {
      entityId = `sp_u_${contributionId.slice(0, 8)}`;
      this.state.species.set(entityId, {
        id: entityId,
        name: element.name,
        nameAr: element.nameAr ?? element.name,
        population: 80,
        traits: element.traits,
        biomes: element.possibleBiomes,
        regionIds: [regionId],
        contributionId,
        trophicLevel: (element.traits.aggression ?? 0) > 0.6 ? 2 : 1,
      });
      const ev: SimEvent = {
        id: makeEventId("sp"),
        type: "SPECIES_CREATED",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `New species: ${element.name}`,
        titleAr: `نوع جديد: ${element.nameAr ?? element.name}`,
        description: `Species introduced into the food web.`,
        descriptionAr: `أُدخل النوع إلى الشبكة الغذائية.`,
        importance: 0.85,
        cause: rootId,
        relatedEntityIds: [entityId],
        contributionId,
        directImpact: { population: 80 },
        confidence: 0.95,
        metadata: {},
      };
      this.events.append(ev, { eventId: rootId, relation: "creates", strength: 1 });
      events.push(ev);
    } else if (cat === "civilization") {
      entityId = `civ_u_${contributionId.slice(0, 8)}`;
      const cityId = `city_u_${contributionId.slice(0, 8)}`;
      this.state.cities.set(cityId, {
        id: cityId,
        name: `${element.name} Capital`,
        nameAr: `عاصمة ${element.nameAr ?? element.name}`,
        regionId,
        population: 3000,
        civilizationId: entityId,
      });
      this.state.civilizations.set(entityId, {
        id: entityId,
        name: element.name,
        nameAr: element.nameAr ?? element.name,
        population: 3000,
        techLevel: element.traits.intelligence ?? 0.3,
        military: element.traits.aggression ?? 0.3,
        economy: 0.4,
        food: 0.6,
        stability: 0.7,
        aggression: element.traits.aggression ?? 0.3,
        happiness: "0.6",
        education: element.traits.intelligence ?? 0.3,
        pollution: 0.05,
        government: "tribal",
        culture: element.name,
        language: element.name,
        regionIds: [regionId],
        cityIds: [cityId],
        allies: [],
        enemies: [],
        memory: [],
        contributionId,
      });
      region.civilizationId = entityId;
      region.population += 3000;
      const ev: SimEvent = {
        id: makeEventId("civ"),
        type: "CIVILIZATION_FOUNDED",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `${element.name} founded`,
        titleAr: `تأسيس ${element.nameAr ?? element.name}`,
        description: `A new civilization settles the region.`,
        descriptionAr: `استقرت حضارة جديدة في المنطقة.`,
        importance: 0.95,
        cause: rootId,
        relatedEntityIds: [entityId, cityId],
        contributionId,
        directImpact: { population: 3000 },
        confidence: 1,
        metadata: {},
      };
      this.events.append(ev, { eventId: rootId, relation: "creates", strength: 1 });
      events.push(ev);
    } else if (cat === "resource" || cat === "energy_source") {
      entityId = `res_u_${contributionId.slice(0, 8)}`;
      this.state.resources.set(entityId, {
        id: entityId,
        name: element.name,
        nameAr: element.nameAr ?? element.name,
        quantity: 2000,
        renewRate: element.traits.growthRate ?? 0.02,
        value: element.traits.size ?? 0.5,
        regionId,
        controllerCivId: region.civilizationId,
        contributionId,
      });
      const ev: SimEvent = {
        id: makeEventId("res"),
        type: "RESOURCE_DISCOVERED",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `Resource discovered: ${element.name}`,
        titleAr: `اكتشاف مورد: ${element.nameAr ?? element.name}`,
        description: `A valuable resource appears and may reshape trade.`,
        descriptionAr: `ظهر مورد ثمين قد يعيد تشكيل التجارة.`,
        importance: 0.8,
        cause: rootId,
        relatedEntityIds: [entityId],
        contributionId,
        directImpact: { quantity: 2000 },
        confidence: 0.95,
        metadata: {},
      };
      this.events.append(ev, { eventId: rootId, relation: "creates", strength: 1 });
      events.push(ev);
    } else if (cat === "disease") {
      entityId = `dis_u_${contributionId.slice(0, 8)}`;
      this.state.diseases.set(entityId, {
        id: entityId,
        name: element.name,
        nameAr: element.nameAr ?? element.name,
        infectivity: element.traits.reproduction ?? 0.4,
        lethality: element.traits.aggression ?? 0.2,
        regionIds: [regionId],
        contributionId,
      });
      const ev: SimEvent = {
        id: makeEventId("dis"),
        type: "DISEASE_OUTBREAK",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `Disease introduced: ${element.name}`,
        titleAr: `مرض مُدخل: ${element.nameAr ?? element.name}`,
        description: `Pathogen enters the biosphere.`,
        descriptionAr: `دخل ممرض إلى المحيط الحيوي.`,
        importance: 0.85,
        cause: rootId,
        relatedEntityIds: [entityId],
        contributionId,
        directImpact: { health: -0.15 },
        confidence: 0.9,
        metadata: {},
      };
      this.events.append(ev, { eventId: rootId, relation: "creates", strength: 1 });
      events.push(ev);
    } else if (cat === "invention" || cat === "technology") {
      entityId = `tech_u_${contributionId.slice(0, 8)}`;
      const holders = region.civilizationId ? [region.civilizationId] : [];
      this.state.technologies.set(entityId, {
        id: entityId,
        name: element.name,
        nameAr: element.nameAr ?? element.name,
        level: element.traits.intelligence ?? 0.5,
        civIds: holders,
      });
      if (region.civilizationId) {
        const civ = this.state.civilizations.get(region.civilizationId);
        if (civ) civ.techLevel = clamp01(civ.techLevel + 0.05);
      }
      const ev: SimEvent = {
        id: makeEventId("tech"),
        type: "TECHNOLOGY_DISCOVERED",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `Invention: ${element.name}`,
        titleAr: `اختراع: ${element.nameAr ?? element.name}`,
        description: `A new technology alters capabilities.`,
        descriptionAr: `تقنية جديدة تغيّر القدرات.`,
        importance: 0.8,
        cause: rootId,
        relatedEntityIds: [entityId, ...holders],
        contributionId,
        directImpact: { techLevel: 0.05 },
        confidence: 0.9,
        metadata: {},
      };
      this.events.append(ev, { eventId: rootId, relation: "creates", strength: 1 });
      events.push(ev);
    } else if (cat === "disaster" || cat === "climate_phenomenon") {
      entityId = `disas_u_${contributionId.slice(0, 8)}`;
      region.temperature = clamp01(region.temperature + (element.traits.heatResistance ?? 0.3) * 0.1);
      region.pollution = clamp01(region.pollution + 0.1);
      const ev: SimEvent = {
        id: makeEventId("vol"),
        type: cat === "disaster" ? "VOLCANO_ERUPTED" : "CLIMATE_CHANGED",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `${element.name} strikes`,
        titleAr: `${element.nameAr ?? element.name} تضرب`,
        description: `A natural force reshapes the region.`,
        descriptionAr: `قوة طبيعية تعيد تشكيل المنطقة.`,
        importance: 0.9,
        cause: rootId,
        relatedEntityIds: [entityId],
        contributionId,
        directImpact: { pollution: 0.1 },
        confidence: 0.9,
        metadata: {},
      };
      this.events.append(ev, { eventId: rootId, relation: "creates", strength: 1 });
      events.push(ev);
    } else {
      // Generic custom / culture / language / alliance / etc.
      entityId = `ent_u_${contributionId.slice(0, 8)}`;
      const ev: SimEvent = {
        id: makeEventId("gen"),
        type: "CULTURE_BORN",
        tick: this.state.tick,
        year: this.state.year,
        regionId,
        title: `${element.name} enters history`,
        titleAr: `${element.nameAr ?? element.name} تدخل التاريخ`,
        description: `Custom element of type ${cat} integrated.`,
        descriptionAr: `دُمج عنصر مخصص من نوع ${cat}.`,
        importance: 0.7,
        cause: rootId,
        relatedEntityIds: [entityId],
        contributionId,
        directImpact: {},
        confidence: 0.8,
        metadata: { category: cat },
      };
      this.events.append(ev, { eventId: rootId, relation: "creates", strength: 1 });
      events.push(ev);
    }

    this.takeSnapshot();
    return { events, entityId };
  }

  /** Monte Carlo future scenarios */
  projectFuture(
    years: number[],
    samples = 8,
  ): {
    horizons: {
      years: number;
      mostLikely: { summary: string; summaryAr: string; keyImpacts: Record<string, number> };
      best: { summary: string; summaryAr: string };
      worst: { summary: string; summaryAr: string };
      uncertainty: number;
      factors: string[];
    }[];
  } {
    const baseSnap = this.takeSnapshot();
    const horizons = years.map((y) => {
      const runs: { score: number; impacts: Record<string, number>; events: number }[] = [];
      for (let s = 0; s < samples; s++) {
        this.rollbackTo(baseSnap.state.tick);
        // Perturb RNG slightly per sample while remaining seeded
        this.rng = new SeededRandom(`${this.state.seed}:mc:${y}:${s}:${this.state.tick}`);
        const ticks = Math.max(1, Math.floor(y));
        let eventCount = 0;
        for (let t = 0; t < Math.min(ticks, 100); t++) {
          const r = this.tick(1);
          eventCount += r.events.length;
        }
        const civPop = [...this.state.civilizations.values()].reduce(
          (a, c) => a + c.population,
          0,
        );
        const wars = this.state.wars.size;
        const pollution =
          [...this.state.regions.values()].reduce((a, r) => a + r.pollution, 0) /
          Math.max(1, this.state.regions.size);
        const score = civPop / 1000 - wars * 50 - pollution * 100;
        runs.push({
          score,
          impacts: { population: civPop, wars, pollution },
          events: eventCount,
        });
      }
      this.rollbackTo(baseSnap.state.tick);
      this.rng.setState(baseSnap.rngState);

      runs.sort((a, b) => a.score - b.score);
      const worst = runs[0]!;
      const best = runs[runs.length - 1]!;
      const mid = runs[Math.floor(runs.length / 2)]!;
      const scores = runs.map((r) => r.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance =
        scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
      const uncertainty = clamp01(Math.sqrt(variance) / (Math.abs(mean) + 1));

      return {
        years: y,
        mostLikely: {
          summary: `After ${y} years: pop≈${Math.round(mid.impacts.population!)}, wars=${mid.impacts.wars}, pollution=${(mid.impacts.pollution ?? 0).toFixed(2)}`,
          summaryAr: `بعد ${y} سنة: سكان≈${Math.round(mid.impacts.population!)}، حروب=${mid.impacts.wars}، تلوث=${(mid.impacts.pollution ?? 0).toFixed(2)}`,
          keyImpacts: mid.impacts,
        },
        best: {
          summary: `Best path: pop≈${Math.round(best.impacts.population!)}`,
          summaryAr: `أفضل مسار: سكان≈${Math.round(best.impacts.population!)}`,
        },
        worst: {
          summary: `Worst path: wars=${worst.impacts.wars}, pollution=${(worst.impacts.pollution ?? 0).toFixed(2)}`,
          summaryAr: `أسوأ مسار: حروب=${worst.impacts.wars}، تلوث=${(worst.impacts.pollution ?? 0).toFixed(2)}`,
        },
        uncertainty,
        factors: [
          "resource_competition",
          "climate_drift",
          "civilization_utility",
          "war_probability",
          "ecology_feedback",
        ],
      };
    });

    return { horizons };
  }

  getPublicState() {
    return {
      seed: this.state.seed,
      tick: this.state.tick,
      year: this.state.year,
      stats: {
        civilizations: this.state.civilizations.size,
        cities: this.state.cities.size,
        species: this.state.species.size,
        plants: this.state.plants.size,
        resources: this.state.resources.size,
        wars: this.state.wars.size,
        tradeRoutes: this.state.tradeRoutes.size,
        technologies: this.state.technologies.size,
        diseases: this.state.diseases.size,
        events: this.events.all().length,
      },
      regions: [...this.state.regions.values()].map((r) => ({
        id: r.id,
        biome: r.biome,
        lat: r.lat,
        lon: r.lon,
        elevation: r.elevation,
        temperature: r.temperature,
        moisture: r.moisture,
        fertility: r.fertility,
        population: r.population,
        pollution: r.pollution,
        civilizationId: r.civilizationId,
      })),
      civilizations: [...this.state.civilizations.values()].map((c) => ({
        id: c.id,
        name: c.name,
        nameAr: c.nameAr,
        population: c.population,
        techLevel: c.techLevel,
        military: c.military,
        economy: c.economy,
        food: c.food,
        stability: c.stability,
        regionIds: c.regionIds,
        allies: c.allies,
        enemies: c.enemies,
      })),
      wars: [...this.state.wars.values()],
      tradeRoutes: [...this.state.tradeRoutes.values()],
    };
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
