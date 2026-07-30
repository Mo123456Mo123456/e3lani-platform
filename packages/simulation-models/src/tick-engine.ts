import type { WorldEventType } from "@planet/shared-types";
import { SeededRandom } from "./rng.js";
import type {
  CausalEdge,
  SimEvent,
  SimWar,
  WorldState,
} from "./world-state.js";
import { cloneWorld, worldMetrics } from "./world-state.js";

export interface TickResult {
  state: WorldState;
  newEvents: SimEvent[];
  newLinks: CausalEdge[];
  metrics: ReturnType<typeof worldMetrics>;
}

/** Per-tick local counter — never module-global (breaks determinism). */
function createEventFactory(state: WorldState) {
  let seq = 0;
  return function makeEvent(
    partial: Omit<SimEvent, "id" | "tick" | "year"> & { id?: string },
  ): SimEvent {
    seq += 1;
    return {
      id: partial.id ?? `evt_${state.seed}_${state.tick}_${seq}`,
      tick: state.tick,
      year: state.year,
      ...partial,
    };
  };
}

type MakeEvent = ReturnType<typeof createEventFactory>;

function link(
  from: string,
  to: string,
  relation: string,
  strength: number,
  description: string,
  descriptionAr: string,
): CausalEdge {
  return {
    id: `link_${from}_${to}_${relation}`,
    fromEventId: from,
    toEventId: to,
    relation,
    strength,
    description,
    descriptionAr,
  };
}

/**
 * Advance the world by one deterministic tick.
 * Same seed + same prior state ⇒ identical results.
 */
export function advanceTick(input: WorldState, steps = 1): TickResult {
  let state = cloneWorld(input);
  const allEvents: SimEvent[] = [];
  const allLinks: CausalEdge[] = [];

  for (let s = 0; s < steps; s++) {
    const rng = new SeededRandom(state.rngState ^ (state.tick + 1) ^ state.seed);
    state.tick += 1;
    const yearDelta =
      state.tickUnit === "day"
        ? 1 / 365
        : state.tickUnit === "month"
          ? 1 / 12
          : state.tickUnit === "decade"
            ? 10
            : 1;
    state.year = Math.round((state.year + yearDelta) * 1000) / 1000;

    const tickEvents: SimEvent[] = [];
    const tickLinks: CausalEdge[] = [];
    const makeEvent = createEventFactory(state);

    runClimate(state, rng, tickEvents, makeEvent);
    runEcosystem(state, rng, tickEvents, tickLinks, makeEvent);
    runEconomy(state, rng, tickEvents, makeEvent);
    runCivilizations(state, rng, tickEvents, tickLinks, makeEvent);
    runWars(state, rng, tickEvents, tickLinks, makeEvent);
    runMigrations(state, rng, tickEvents, makeEvent);
    runDiseases(state, rng, tickEvents, makeEvent);
    runContributionEchoes(state, rng, tickEvents, tickLinks, makeEvent);

    const completed = makeEvent({
      type: "TICK_COMPLETED",
      title: `Tick ${state.tick}`,
      titleAr: `نبضة ${state.tick}`,
      description: `Simulation advanced to year ${state.year}`,
      descriptionAr: `تقدمت المحاكاة إلى السنة ${state.year}`,
      importance: 0.1,
      confidence: 1,
      causes: ["tick_engine"],
      effects: ["state_updated"],
      actorIds: [],
      payload: { metrics: worldMetrics(state) },
    });
    tickEvents.push(completed);

    state.events.push(...tickEvents);
    state.causalLinks.push(...tickLinks);
    state.rngState = rng.getState();
    // Cap in-memory event log for long runs (DB stores full history)
    if (state.events.length > 5000) {
      state.events = state.events.slice(-4000);
    }

    allEvents.push(...tickEvents);
    allLinks.push(...tickLinks);
  }

  return {
    state,
    newEvents: allEvents,
    newLinks: allLinks,
    metrics: worldMetrics(state),
  };
}

function runClimate(state: WorldState, rng: SeededRandom, events: SimEvent[], makeEvent: MakeEvent): void {
  for (const region of state.regions) {
    if (region.biome === "ocean") continue;
    // Vegetation cools, pollution warms, elevation buffers
    const plantCool =
      state.plants
        .filter((p) => p.regionIds.includes(region.id))
        .reduce((s, p) => s + p.pollutionAbsorption * p.coverage, 0) * 0.01;
    const warm = region.pollution * 0.02 + rng.float(-0.005, 0.008);
    region.temperature = clamp(region.temperature + warm - plantCool, 0, 1);
    region.moisture = clamp(
      region.moisture + rng.float(-0.02, 0.02) - region.pollution * 0.01,
      0,
      1,
    );
    region.pollution = clamp(region.pollution * 0.995 + rng.float(0, 0.002), 0, 1);

    // Fire / drought / flood cellular-style local effects
    if (region.temperature > 0.8 && region.moisture < 0.25 && rng.bool(0.02)) {
      region.fertility = clamp(region.fertility - 0.05, 0, 1);
      region.pollution = clamp(region.pollution + 0.05, 0, 1);
      events.push(
        makeEvent({
          type: "CLIMATE_CHANGED",
          title: `Drought in ${region.name}`,
          titleAr: `جفاف في ${region.nameAr}`,
          description: "High heat and low moisture triggered drought stress.",
          descriptionAr: "أدت الحرارة المرتفعة والرطوبة المنخفضة إلى ضغط جفاف.",
          regionId: region.id,
          importance: 0.55,
          confidence: 0.9,
          causes: ["high_temperature", "low_moisture"],
          effects: ["fertility_drop", "pollution_rise"],
          actorIds: [],
          payload: { kind: "drought" },
        }),
      );
    }

    if (region.biome === "volcanic" && rng.bool(0.008)) {
      region.pollution = clamp(region.pollution + 0.15, 0, 1);
      region.temperature = clamp(region.temperature + 0.05, 0, 1);
      events.push(
        makeEvent({
          type: "VOLCANO_ERUPTED",
          title: `Volcano erupted near ${region.name}`,
          titleAr: `ثوران بركان قرب ${region.nameAr}`,
          description: "Ash and heat altered local climate and fertility.",
          descriptionAr: "غيّر الرماد والحرارة المناخ المحلي والخصوبة.",
          regionId: region.id,
          importance: 0.8,
          confidence: 0.95,
          causes: ["volcanic_activity"],
          effects: ["pollution_spike", "temperature_rise"],
          actorIds: [],
          payload: {},
        }),
      );
    }
  }
}

function runEcosystem(
  state: WorldState,
  rng: SeededRandom,
  events: SimEvent[],
  links: CausalEdge[],
  makeEvent: MakeEvent,
): void {
  // Lotka–Volterra-inspired predator-prey between high/low trophic species in shared regions
  for (const prey of state.species) {
    const region = state.regions.find((r) => r.id === prey.regionIds[0]);
    if (!region || region.biome === "ocean") continue;

    const carrying = 1000 + region.fertility * 80_000;
    const predators = state.species.filter(
      (s) =>
        s.id !== prey.id &&
        s.trophicLevel > prey.trophicLevel &&
        s.regionIds.some((id) => prey.regionIds.includes(id)),
    );
    const predation = predators.reduce((s, p) => s + p.population * p.aggression * 0.00001, 0);
    const growth =
      prey.reproduction * (1 - prey.population / carrying) - predation - prey.foodNeed * 0.01;
    prey.population = Math.max(0, Math.floor(prey.population * (1 + growth * 0.1)));

    // Plants affect food
    const localPlants = state.plants.filter((p) =>
      p.regionIds.some((id) => prey.regionIds.includes(id)),
    );
    if (localPlants.length && prey.trophicLevel < 0.45) {
      prey.population += Math.floor(
        localPlants.reduce((s, p) => s + p.coverage * p.growthRate, 0) * 20,
      );
    }

    if (prey.population <= 0 && rng.bool(0.3)) {
      const evt = makeEvent({
        type: "SPECIES_EXTINCT",
        title: `${prey.name} went extinct`,
        titleAr: `انقرض ${prey.nameAr}`,
        description: "Population collapsed below viable levels.",
        descriptionAr: "انهار التعداد دون مستوى البقاء.",
        regionId: region.id,
        importance: 0.75,
        confidence: 0.92,
        causes: ["predation", "resource_stress", "carrying_capacity"],
        effects: ["biodiversity_loss"],
        contributionId: prey.contributionId,
        actorIds: [prey.id],
        payload: { speciesId: prey.id },
      });
      events.push(evt);
    }

    // Mutation / subspecies
    if (prey.population > 5000 && rng.bool(prey.mutationRate * 0.05)) {
      const mutant = {
        ...structuredClone(prey),
        id: `spc_mut_${state.tick}_${prey.id}`,
        name: `${prey.name} Variant`,
        nameAr: `${prey.nameAr} متغير`,
        population: Math.floor(prey.population * 0.05),
        adaptability: clamp(prey.adaptability + rng.float(0, 0.1), 0, 1),
      };
      prey.population -= mutant.population;
      state.species.push(mutant);
      const evt = makeEvent({
        type: "SPECIES_MUTATED",
        title: `Mutation: ${mutant.name}`,
        titleAr: `طفرة: ${mutant.nameAr}`,
        description: "Natural selection produced a regional variant.",
        descriptionAr: "أفرز الانتقاء الطبيعي متغيرًا إقليميًا.",
        regionId: region.id,
        importance: 0.5,
        confidence: 0.8,
        causes: ["mutation_rate", "selection_pressure"],
        effects: ["new_subspecies"],
        contributionId: prey.contributionId,
        actorIds: [prey.id, mutant.id],
        payload: { parentId: prey.id, mutantId: mutant.id },
      });
      events.push(evt);
    }
  }

  for (const plant of state.plants) {
    const region = state.regions.find((r) => r.id === plant.regionIds[0]);
    if (!region) continue;
    const waterOk = region.water >= plant.waterNeed * 0.5;
    const delta = waterOk ? plant.growthRate * 0.03 : -0.02;
    plant.coverage = clamp(plant.coverage + delta, 0, 1);
    region.pollution = clamp(region.pollution - plant.pollutionAbsorption * 0.01 * plant.coverage, 0, 1);
    region.fertility = clamp(region.fertility + plant.fertilityBoost * 0.005 * plant.coverage, 0, 1);

    // Spread to neighbor
    if (plant.coverage > 0.6 && rng.bool(0.05)) {
      const neighbors = region.neighbors
        .map((i) => state.regions[i])
        .filter((r) => r && r.biome !== "ocean");
      if (neighbors.length) {
        const target = rng.pick(neighbors);
        if (!plant.regionIds.includes(target.id)) {
          plant.regionIds.push(target.id);
          const evt = makeEvent({
            type: "PLANT_SPREAD",
            title: `${plant.name} spread`,
            titleAr: `انتشار ${plant.nameAr}`,
            description: `Spread into ${target.name}`,
            descriptionAr: `امتد إلى ${target.nameAr}`,
            regionId: target.id,
            importance: 0.45,
            confidence: 0.85,
            causes: ["high_coverage", "suitable_neighbor"],
            effects: ["range_expansion"],
            contributionId: plant.contributionId,
            actorIds: [plant.id],
            payload: { plantId: plant.id, to: target.id },
          });
          events.push(evt);
          if (plant.contributionId) {
            const causeEvt = state.events.find(
              (e) => e.contributionId === plant.contributionId && e.type === "CONTRIBUTION_APPLIED",
            );
            if (causeEvt) {
              links.push(
                link(
                  causeEvt.id,
                  evt.id,
                  "led_to",
                  0.7,
                  "User contribution enabled plant spread",
                  "مساهمة المستخدم مكّنت انتشار النبات",
                ),
              );
            }
          }
        }
      }
    }
  }
}

function runEconomy(state: WorldState, rng: SeededRandom, events: SimEvent[], makeEvent: MakeEvent): void {
  for (const res of state.resources) {
    res.amount = clamp(res.amount - res.extractRate * 0.5 + res.renewRate, 0, 1.5);
    if (res.amount < 0.05 && rng.bool(0.2)) {
      events.push(
        makeEvent({
          type: "RESOURCE_DEPLETED",
          title: `${res.name} depleted`,
          titleAr: `نفاد ${res.nameAr}`,
          description: "Extraction exceeded renewal.",
          descriptionAr: "تجاوز الاستخراج معدل التجدد.",
          regionId: res.regionId,
          importance: 0.65,
          confidence: 0.9,
          causes: ["over_extraction"],
          effects: ["economic_stress"],
          contributionId: res.contributionId,
          actorIds: [res.id],
          payload: { resourceId: res.id },
        }),
      );
    }
  }

  // Simple trade route formation between rich cities
  if (state.cities.length >= 2 && rng.bool(0.08)) {
    const a = rng.pick(state.cities);
    const b = rng.pick(state.cities.filter((c) => c.id !== a.id));
    if (b && !state.tradeRoutes.some((t) => t.fromCityId === a.id && t.toCityId === b.id)) {
      const resource = rng.pick(state.resources);
      const route = {
        id: `trade_${state.tick}_${a.id}_${b.id}`,
        fromCityId: a.id,
        toCityId: b.id,
        resourceId: resource.id,
        volume: rng.float(0.1, 0.8),
        risk: rng.float(0.05, 0.5),
      };
      state.tradeRoutes.push(route);
      events.push(
        makeEvent({
          type: "TRADE_ROUTE_CREATED",
          title: `Trade: ${a.name} → ${b.name}`,
          titleAr: `تجارة: ${a.nameAr} → ${b.nameAr}`,
          description: "A new trade route formed based on supply and demand.",
          descriptionAr: "تشكّل طريق تجاري جديد بناءً على العرض والطلب.",
          regionId: a.regionId,
          importance: 0.5,
          confidence: 0.8,
          causes: ["supply_demand", "city_connectivity"],
          effects: ["economy_boost"],
          actorIds: [a.civilizationId, b.civilizationId],
          payload: { routeId: route.id },
        }),
      );
    }
  }
}

function runCivilizations(
  state: WorldState,
  rng: SeededRandom,
  events: SimEvent[],
  links: CausalEdge[],
  makeEvent: MakeEvent,
): void {
  for (const civ of state.civilizations) {
    // Utility scoring for actions
    const needFood = 1 - civ.food;
    const needSecurity = civ.enemies.length * 0.2 + (1 - civ.military) * 0.3;
    const needGrowth = 1 - Math.min(1, civ.population / 5_000_000);
    const researchDrive = civ.innovation * (1 - civ.techLevel);

    civ.food = clamp(civ.food + rng.float(-0.03, 0.04) + civ.economy * 0.01, 0, 1);
    civ.population = Math.max(
      1000,
      Math.floor(civ.population * (1 + (civ.food - 0.4) * 0.01 - civ.pollution * 0.005)),
    );
    civ.stability = clamp(
      civ.stability + (civ.happiness - 0.5) * 0.02 - (civ.enemies.length > 0 ? 0.01 : 0),
      0,
      1,
    );
    civ.happiness = clamp(civ.happiness + (civ.food - 0.5) * 0.02 - civ.pollution * 0.01, 0, 1);
    civ.pollution = clamp(civ.pollution * 0.99 + civ.techLevel * 0.002, 0, 1);

    // Research
    if (researchDrive > 0.3 && rng.bool(0.06)) {
      civ.techLevel = clamp(civ.techLevel + 0.02, 0, 1);
      const tech = {
        id: `tech_dyn_${state.tick}_${civ.id}`,
        name: `Innovation ${state.tick}`,
        nameAr: `ابتكار ${state.tick}`,
        level: civ.techLevel,
        category: "science",
        discovererCivId: civ.id,
      };
      state.technologies.push(tech);
      events.push(
        makeEvent({
          type: "TECHNOLOGY_DISCOVERED",
          title: `${civ.name} discovered ${tech.name}`,
          titleAr: `${civ.nameAr} اكتشف ${tech.nameAr}`,
          description: "Research investment yielded a new technology.",
          descriptionAr: "أثمر الاستثمار في البحث تقنية جديدة.",
          regionId: civ.regionIds[0],
          importance: 0.6,
          confidence: 0.85,
          causes: ["innovation", "education"],
          effects: ["tech_level_up"],
          actorIds: [civ.id],
          payload: { technologyId: tech.id },
        }),
      );
    }

    // Found city if growing
    if (needGrowth > 0.5 && civ.food > 0.55 && rng.bool(0.04)) {
      const region = state.regions.find((r) => r.id === civ.regionIds[0]);
      const neighbors = region
        ? region.neighbors.map((i) => state.regions[i]!).filter((r) => r.biome !== "ocean")
        : [];
      if (neighbors.length) {
        const target = rng.pick(neighbors);
        const city = {
          id: `city_dyn_${state.tick}_${civ.id}`,
          name: `${civ.name} Colony`,
          nameAr: `مستعمرة ${civ.nameAr}`,
          regionId: target.id,
          population: Math.floor(civ.population * 0.05),
          civilizationId: civ.id,
        };
        civ.population -= city.population;
        target.population += city.population;
        if (!civ.regionIds.includes(target.id)) civ.regionIds.push(target.id);
        state.cities.push(city);
        events.push(
          makeEvent({
            type: "CITY_CREATED",
            title: `${city.name} founded`,
            titleAr: `تأسيس ${city.nameAr}`,
            description: "Expansion driven by population pressure and food surplus.",
            descriptionAr: "توسع مدفوع بالضغط السكاني وفائض الغذاء.",
            regionId: target.id,
            importance: 0.55,
            confidence: 0.88,
            causes: ["population_pressure", "food_surplus"],
            effects: ["territorial_expansion"],
            actorIds: [civ.id],
            payload: { cityId: city.id },
          }),
        );
      }
    }

    // Alliance
    if (needSecurity > 0.5 && rng.bool(0.05)) {
      const other = rng.pick(state.civilizations.filter((c) => c.id !== civ.id && !civ.enemies.includes(c.id)));
      if (other && !civ.allies.includes(other.id)) {
        civ.allies.push(other.id);
        other.allies.push(civ.id);
        events.push(
          makeEvent({
            type: "ALLIANCE_CREATED",
            title: `Alliance: ${civ.name} & ${other.name}`,
            titleAr: `تحالف: ${civ.nameAr} و ${other.nameAr}`,
            description: "Strategic interests aligned against shared risks.",
            descriptionAr: "توافقت المصالح الاستراتيجية ضد مخاطر مشتركة.",
            regionId: civ.regionIds[0],
            importance: 0.6,
            confidence: 0.8,
            causes: ["security_need", "shared_interests"],
            effects: ["diplomatic_shift"],
            actorIds: [civ.id, other.id],
            payload: {},
          }),
        );
      }
    }

    // Memory affects aggression toward past attackers
    for (const mem of civ.memory) {
      if (mem.kind === "attacked_by" && mem.targetId) {
        civ.aggression = clamp(civ.aggression + mem.intensity * 0.001, 0, 1);
        if (!civ.enemies.includes(mem.targetId)) {
          // lingering hostility
        }
      }
    }

    void links;
  }
}

function runWars(
  state: WorldState,
  rng: SeededRandom,
  events: SimEvent[],
  links: CausalEdge[],
  makeEvent: MakeEvent,
): void {
  // Resolve ongoing wars
  for (const war of [...state.wars]) {
    const attacker = state.civilizations.find((c) => c.id === war.attackerId);
    const defender = state.civilizations.find((c) => c.id === war.defenderId);
    if (!attacker || !defender) {
      state.wars = state.wars.filter((w) => w.id !== war.id);
      continue;
    }
    const atkPower =
      attacker.military * attacker.techLevel * (0.7 + attacker.economy * 0.3) * rng.float(0.8, 1.2);
    const defPower =
      defender.military * defender.techLevel * (0.7 + defender.stability * 0.3) * rng.float(0.8, 1.2);
    const region = state.regions.find((r) => r.id === war.regionId);
    const terrainMod = region && region.biome === "mountain" ? 0.85 : 1;
    const ratio = (atkPower * terrainMod) / Math.max(0.01, defPower);

    attacker.population = Math.floor(attacker.population * (1 - 0.01 * (1 / ratio)));
    defender.population = Math.floor(defender.population * (1 - 0.01 * ratio));
    attacker.economy = clamp(attacker.economy - 0.02, 0, 1);
    defender.economy = clamp(defender.economy - 0.03, 0, 1);

    if (state.tick - war.startedTick > 3 || ratio > 1.8 || ratio < 0.55) {
      state.wars = state.wars.filter((w) => w.id !== war.id);
      const attackerWon = ratio >= 1;
      const winner = attackerWon ? attacker : defender;
      const loser = attackerWon ? defender : attacker;
      loser.stability = clamp(loser.stability - 0.1, 0, 1);
      winner.military = clamp(winner.military + 0.02, 0, 1);
      loser.memory.push({
        tick: state.tick,
        kind: "attacked_by",
        targetId: winner.id,
        intensity: 0.8,
        note: `Lost war against ${winner.name}`,
      });
      const evt = makeEvent({
        type: "WAR_ENDED",
        title: `War ended: ${winner.name} prevailed`,
        titleAr: `انتهت الحرب: انتصرت ${winner.nameAr}`,
        description: `Conflict resolved. Cause was: ${war.cause}`,
        descriptionAr: `حُسم الصراع. السبب كان: ${war.cause}`,
        regionId: war.regionId,
        importance: 0.85,
        confidence: 0.9,
        causes: [war.cause, "military_balance", "logistics"],
        effects: ["border_shift", "displacement", "tech_pressure"],
        actorIds: [attacker.id, defender.id],
        payload: { winnerId: winner.id, loserId: loser.id, ratio },
      });
      events.push(evt);
    }
  }

  // Start wars only with causes
  if (state.wars.length < 4) {
    for (const civ of state.civilizations) {
      for (const other of state.civilizations) {
        if (other.id === civ.id) continue;
        if (civ.allies.includes(other.id)) continue;
        if (state.wars.some((w) => w.attackerId === civ.id && w.defenderId === other.id)) continue;

        const sharedRegions = civ.regionIds.filter((id) => other.regionIds.includes(id));
        const near =
          sharedRegions.length > 0 ||
          civ.regionIds.some((id) => {
            const r = state.regions.find((x) => x.id === id);
            return r?.neighbors.some((ni) => other.regionIds.includes(state.regions[ni]!.id));
          });

        const resourceTension = state.resources.some(
          (res) =>
            res.amount < 0.25 &&
            (civ.regionIds.includes(res.regionId) || other.regionIds.includes(res.regionId)),
        );
        const foodPressure = civ.food < 0.35;
        const historicalHate = civ.memory
          .filter((m) => m.targetId === other.id)
          .reduce((s, m) => s + m.intensity, 0);

        let score = 0;
        const causes: string[] = [];
        if (near) {
          score += 0.15;
          causes.push("geographic_proximity");
        }
        if (resourceTension) {
          score += 0.25;
          causes.push("resource_conflict");
        }
        if (foodPressure) {
          score += 0.2;
          causes.push("food_shortage");
        }
        if (historicalHate > 0.5) {
          score += 0.25;
          causes.push("historical_hostility");
        }
        score += civ.aggression * 0.2;
        score += (civ.military - other.military) * 0.1;
        if (civ.population > other.population * 1.3) score += 0.05;

        if (score > 0.55 && causes.length > 0 && rng.bool(Math.min(0.12, score * 0.15))) {
          const war: SimWar = {
            id: `war_${state.tick}_${civ.id}_${other.id}`,
            attackerId: civ.id,
            defenderId: other.id,
            regionId: civ.regionIds[0]!,
            strength: score,
            startedTick: state.tick,
            cause: causes[0]!,
          };
          state.wars.push(war);
          if (!civ.enemies.includes(other.id)) civ.enemies.push(other.id);
          if (!other.enemies.includes(civ.id)) other.enemies.push(civ.id);
          const evt = makeEvent({
            type: "WAR_STARTED",
            title: `War: ${civ.name} vs ${other.name}`,
            titleAr: `حرب: ${civ.nameAr} ضد ${other.nameAr}`,
            description: `Conflict ignited due to ${causes.join(", ")}`,
            descriptionAr: `اندلع الصراع بسبب ${causes.join("، ")}`,
            regionId: war.regionId,
            importance: 0.9,
            confidence: 0.85,
            causes,
            effects: ["casualties", "migration_pressure", "economy_damage"],
            actorIds: [civ.id, other.id],
            payload: { warId: war.id, score },
          });
          events.push(evt);
          void links;
          return; // at most one new war per tick globally for pacing
        }
      }
    }
  }
}

function runMigrations(state: WorldState, rng: SeededRandom, events: SimEvent[], makeEvent: MakeEvent): void {
  state.migrations = state.migrations.filter((m) => state.tick - m.startedTick < 5);

  for (const civ of state.civilizations) {
    if ((civ.food < 0.3 || civ.stability < 0.3) && rng.bool(0.06)) {
      const from = state.regions.find((r) => r.id === civ.regionIds[0]);
      if (!from) continue;
      const candidates = from.neighbors
        .map((i) => state.regions[i]!)
        .filter((r) => r.biome !== "ocean" && r.fertility > from.fertility);
      if (!candidates.length) continue; // impossible migrations blocked
      const to = rng.pick(candidates);
      const pop = Math.floor(civ.population * 0.08);
      civ.population -= pop;
      to.population += pop;
      const mig = {
        id: `mig_${state.tick}_${civ.id}`,
        fromRegionId: from.id,
        toRegionId: to.id,
        population: pop,
        civilizationId: civ.id,
        startedTick: state.tick,
        reason: civ.food < 0.3 ? "food_shortage" : "instability",
      };
      state.migrations.push(mig);
      events.push(
        makeEvent({
          type: "MIGRATION_STARTED",
          title: `Migration from ${from.name}`,
          titleAr: `هجرة من ${from.nameAr}`,
          description: `${pop} people moved due to ${mig.reason}`,
          descriptionAr: `انتقل ${pop} شخصًا بسبب ${mig.reason}`,
          regionId: to.id,
          importance: 0.6,
          confidence: 0.87,
          causes: [mig.reason],
          effects: ["demographic_shift"],
          actorIds: [civ.id],
          payload: { migrationId: mig.id },
        }),
      );
    }
  }
}

function runDiseases(state: WorldState, rng: SeededRandom, events: SimEvent[], makeEvent: MakeEvent): void {
  for (const disease of state.diseases) {
    disease.infected = Math.floor(disease.infected * (1 + disease.contagiousness * 0.1));
    for (const civ of state.civilizations) {
      if (disease.regionIds.some((id) => civ.regionIds.includes(id))) {
        civ.health = clamp(civ.health - disease.lethality * 0.02, 0, 1);
        civ.population = Math.floor(civ.population * (1 - disease.lethality * 0.005));
      }
    }
    if (rng.bool(0.1)) {
      // spread
      const r = state.regions.find((x) => disease.regionIds.includes(x.id));
      const n = r?.neighbors.map((i) => state.regions[i]!).find((x) => x.biome !== "ocean");
      if (n && !disease.regionIds.includes(n.id)) disease.regionIds.push(n.id);
    }
    if (disease.infected > 0 && rng.bool(0.08 * (1 - disease.contagiousness))) {
      events.push(
        makeEvent({
          type: "DISEASE_CONTAINED",
          title: `${disease.name} contained`,
          titleAr: `احتواء ${disease.nameAr}`,
          description: "Health measures reduced outbreak intensity.",
          descriptionAr: "خفّضت الإجراءات الصحية حدة التفشي.",
          regionId: disease.regionIds[0],
          importance: 0.5,
          confidence: 0.75,
          causes: ["health_response"],
          effects: ["outbreak_reduced"],
          contributionId: disease.contributionId,
          actorIds: [disease.id],
          payload: {},
        }),
      );
      disease.contagiousness *= 0.7;
      if (disease.contagiousness < 0.1) {
        state.diseases = state.diseases.filter((d) => d.id !== disease.id);
      }
    }
  }
}

function runContributionEchoes(
  state: WorldState,
  rng: SeededRandom,
  events: SimEvent[],
  links: CausalEdge[],
  makeEvent: MakeEvent,
): void {
  for (const contrib of state.contributions) {
    const age = state.tick - contrib.appliedTick;
    if (age <= 0 || age % 5 !== 0) continue;

    if (contrib.category === "plant") {
      const plant = state.plants.find((p) => p.id === contrib.entityId);
      if (!plant) continue;
      const civ = state.civilizations.find((c) =>
        c.regionIds.some((id) => plant.regionIds.includes(id)),
      );
      if (civ && rng.bool(0.4)) {
        civ.economy = clamp(civ.economy + (plant.energyOutput || 0) * 0.02, 0, 1);
        const evt = makeEvent({
          type: "POPULATION_BOOM",
          title: `${civ.name} benefited from ${plant.name}`,
          titleAr: `${civ.nameAr} استفادت من ${plant.nameAr}`,
          description: "A user-added plant altered local prosperity.",
          descriptionAr: "غيّر نبات أضافه مستخدم ازدهار المنطقة.",
          regionId: plant.regionIds[0],
          importance: 0.55,
          confidence: 0.8,
          causes: ["user_contribution", "resource_utilization"],
          effects: ["economy_boost"],
          contributionId: contrib.id,
          actorIds: [civ.id, plant.id],
          payload: {},
        });
        events.push(evt);
        const origin = state.events.find(
          (e) => e.contributionId === contrib.id && e.type === "CONTRIBUTION_APPLIED",
        );
        if (origin) {
          links.push(
            link(
              origin.id,
              evt.id,
              "long_term_effect",
              0.65,
              "Contribution produced delayed civilizational benefit",
              "أنتجت المساهمة نفعًا حضاريًا متأخرًا",
            ),
          );
        }
      }
    }

    if (contrib.category === "resource" && age >= 5 && rng.bool(0.3)) {
      const res = state.resources.find((r) => r.id === contrib.entityId);
      if (!res) continue;
      const cities = state.cities.filter((c) => {
        const civ = state.civilizations.find((x) => x.id === c.civilizationId);
        return civ?.regionIds.includes(res.regionId);
      });
      if (cities.length >= 1 && state.cities.length >= 2) {
        const from = cities[0]!;
        const to = rng.pick(state.cities.filter((c) => c.id !== from.id));
        if (
          to &&
          !state.tradeRoutes.some((t) => t.fromCityId === from.id && t.resourceId === res.id)
        ) {
          state.tradeRoutes.push({
            id: `trade_c_${contrib.id}_${state.tick}`,
            fromCityId: from.id,
            toCityId: to.id,
            resourceId: res.id,
            volume: res.value,
            risk: 0.2,
          });
          const evt = makeEvent({
            type: "TRADE_ROUTE_CREATED",
            title: `Trade formed around ${res.name}`,
            titleAr: `طريق تجاري حول ${res.nameAr}`,
            description: "User resource sparked a trade corridor.",
            descriptionAr: "أثار مورد المستخدم ممرًا تجاريًا.",
            regionId: res.regionId,
            importance: 0.6,
            confidence: 0.82,
            causes: ["user_contribution", "resource_value"],
            effects: ["trade_network_growth"],
            contributionId: contrib.id,
            actorIds: [from.civilizationId, to.civilizationId],
            payload: {},
          });
          events.push(evt);
        }
      }
    }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function replayEvents(
  base: WorldState,
  eventTypes: WorldEventType[],
): WorldState {
  // Structural guarantee helper for tests — state already event-sourced in engine
  const filtered = cloneWorld(base);
  filtered.events = filtered.events.filter((e) => eventTypes.includes(e.type));
  return filtered;
}
