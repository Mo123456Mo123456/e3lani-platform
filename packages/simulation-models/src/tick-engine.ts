import type { WorldEventDto, SimulationEffect } from "@planet/shared-types";
import { SeededRng, hashString } from "./rng.js";
import { buildCausalGraph } from "./causal.js";
import { buildRegionGraph, dijkstra } from "./pathfinding.js";
import type {
  TickResult,
  WorldState,
  SimCivilization,
  SimRegion,
} from "./world-state.js";
import { GRID_SIZE } from "@planet/config";

function cloneState(state: WorldState): WorldState {
  return structuredClone(state);
}

function eventId(seed: number, tick: number, salt: string): string {
  return `evt_${hashString(`${seed}:${tick}:${salt}`).toString(16)}`;
}

function regionById(state: WorldState, id: string): SimRegion | undefined {
  return state.regions.find((r) => r.id === id);
}

function updateClimate(state: WorldState, rng: SeededRng, effects: SimulationEffect[]) {
  for (const region of state.regions) {
    if (region.biome === "ocean") continue;
    const vegBoost = region.plantIds.length * 0.002;
    const pollute = region.pollution * 0.01;
    region.temperature = clamp(
      region.temperature + (rng.next() - 0.5) * 0.01 + pollute - vegBoost * 0.3,
    );
    region.moisture = clamp(
      region.moisture + (rng.next() - 0.48) * 0.015 - region.elevation * 0.001,
    );
    region.pollution = clamp(region.pollution * 0.98 + pollute * 0.1);
    if (region.pollution > 0.7 && rng.chance(0.05)) {
      effects.push({
        domain: "climate",
        metric: "desertification_pressure",
        delta: 0.05,
        confidence: 0.7,
        explanationKey: "high_pollution_dries_land",
      });
      region.fertility = clamp(region.fertility - 0.02);
    }
  }
}

function updateEcology(state: WorldState, rng: SeededRng, events: WorldEventDto[], effects: SimulationEffect[]) {
  for (const species of state.species) {
    const preyPressure = species.preyOf.length * 0.02;
    const food = Math.max(0.1, 1 - preyPressure + species.reproduction);
    const carrying = 8000 * (0.4 + species.adaptability);
    const growth = species.population * species.reproduction * food * (1 - species.population / carrying);
    species.population = Math.max(0, Math.floor(species.population + growth + (rng.next() - 0.5) * 20));

    if (species.population < 10 && rng.chance(0.15)) {
      species.population = 0;
      events.push({
        id: eventId(state.seed, state.tick, `extinct_${species.id}`),
        type: "SPECIES_EXTINCT",
        title: `انقراض ${species.name}`,
        titleEn: `Extinction of ${species.nameEn}`,
        summary: `انقرض ${species.name} بسبب ضغط بيئي ومنافسة غذائية.`,
        summaryEn: `${species.nameEn} went extinct due to ecological pressure.`,
        tick: state.tick,
        year: state.year,
        importance: 0.8,
        causes: ["low_population", "predator_pressure"],
        effects: [
          {
            domain: "creatures",
            metric: "biodiversity",
            delta: -0.02,
            confidence: 0.9,
            explanationKey: "species_lost",
          },
        ],
        confidence: 0.9,
        contributionId: species.contributionId,
        createdAt: new Date().toISOString(),
      });
      effects.push({
        domain: "creatures",
        metric: "biodiversity",
        delta: -0.02,
        confidence: 0.9,
        explanationKey: "species_lost",
      });
    }
  }

  for (const plant of state.plants) {
    plant.coverage = clamp(plant.coverage + plant.growthRate * 0.02 - plant.waterNeed * 0.005);
  }
}

function civUtility(civ: SimCivilization): Record<string, number> {
  return {
    expand: (1 - civ.stability) * 0.3 + (1 - civ.food) * 0.5 + civ.aggression * 0.2,
    trade: civ.economy * 0.5 + civ.happiness * 0.3 + (1 - civ.aggression) * 0.2,
    research: civ.innovation * 0.6 + civ.education * 0.4,
    war: civ.aggression * 0.45 + (1 - civ.food) * 0.25 + civ.military * 0.3,
    ally: (1 - civ.stability) * 0.4 + (1 - civ.military) * 0.3 + civ.education * 0.3,
  };
}

function updateCivilizations(
  state: WorldState,
  rng: SeededRng,
  events: WorldEventDto[],
  effects: SimulationEffect[],
) {
  const graph = buildRegionGraph(state.regions, GRID_SIZE);

  for (const civ of state.civilizations) {
    // population vs food & carrying
    const capital = regionById(state, civ.capitalRegionId);
    const foodFactor = civ.food;
    const growth = Math.floor(civ.population * 0.01 * foodFactor * civ.happiness);
    civ.population = Math.max(100, civ.population + growth - Math.floor(civ.pollution * 200));
    if (capital) {
      capital.population = Math.min(capital.carryingCapacity, Math.floor(civ.population * 0.3));
      if (civ.population * 0.3 > capital.carryingCapacity) {
        effects.push({
          domain: "population",
          metric: "overcapacity",
          delta: 0.1,
          confidence: 0.85,
          explanationKey: "exceeded_carrying_capacity",
        });
      }
    }

    civ.food = clamp(civ.food + (rng.next() - 0.45) * 0.05 - civ.pollution * 0.02);
    civ.economy = clamp(civ.economy + (rng.next() - 0.5) * 0.03);
    civ.stability = clamp(civ.stability + (civ.happiness - 0.5) * 0.02 - civ.pollution * 0.01);

    const utilities = civUtility(civ);
    const action = (Object.entries(utilities).sort((a, b) => b[1] - a[1])[0] ?? [
      "trade",
      0,
    ])[0];

    if (action === "research" && rng.chance(0.08 + civ.innovation * 0.1)) {
      const tech = {
        id: `tech_dyn_${state.seed}_${state.tick}_${civ.id}`,
        name: `ابتكار ${civ.name}`,
        nameEn: `Innovation of ${civ.nameEn}`,
        level: clamp(civ.techLevel + 0.05),
        civilizationIds: [civ.id],
      };
      state.technologies.push(tech);
      civ.techLevel = clamp(civ.techLevel + 0.03);
      events.push({
        id: eventId(state.seed, state.tick, `tech_${civ.id}`),
        type: "TECHNOLOGY_DISCOVERED",
        title: `اكتشاف تقنية في ${civ.name}`,
        titleEn: `Technology discovered in ${civ.nameEn}`,
        summary: `طورت ${civ.name} تقنية جديدة مدفوعة بالابتكار والتعليم.`,
        summaryEn: `${civ.nameEn} developed a new technology driven by innovation.`,
        tick: state.tick,
        year: state.year,
        importance: 0.7,
        regionId: civ.capitalRegionId,
        causes: ["innovation", "education"],
        effects: [
          {
            domain: "inventions",
            metric: "tech_level",
            delta: 0.03,
            confidence: 0.8,
            explanationKey: "research_success",
          },
        ],
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      });
    }

    if (action === "ally") {
      const other = state.civilizations.find(
        (c) => c.id !== civ.id && !civ.allyIds.includes(c.id) && !civ.enemyIds.includes(c.id),
      );
      if (other && rng.chance(0.1)) {
        civ.allyIds.push(other.id);
        other.allyIds.push(civ.id);
        state.alliances.push({
          id: `ally_${civ.id}_${other.id}_${state.tick}`,
          aId: civ.id,
          bId: other.id,
          formedTick: state.tick,
        });
        events.push({
          id: eventId(state.seed, state.tick, `ally_${civ.id}_${other.id}`),
          type: "ALLIANCE_CREATED",
          title: `تحالف بين ${civ.name} و${other.name}`,
          titleEn: `Alliance between ${civ.nameEn} and ${other.nameEn}`,
          summary: "تشكّل تحالف بسبب المصالح المشتركة وضعف الاستقرار العسكري.",
          summaryEn: "An alliance formed due to shared interests and military pressure.",
          tick: state.tick,
          year: state.year,
          importance: 0.65,
          causes: ["shared_interest", "security_need"],
          effects: [
            {
              domain: "alliances",
              metric: "alliance_count",
              delta: 1,
              confidence: 0.9,
              explanationKey: "alliance_formed",
            },
          ],
          confidence: 0.9,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (action === "war") {
      const rival = state.civilizations.find((c) => {
        if (c.id === civ.id || civ.allyIds.includes(c.id)) return false;
        const resourceConflict = Math.abs(c.economy - civ.economy) < 0.25;
        const memoryHate = civ.memory.some(
          (m) => m.kind === "attacked_by" && m.targetId === c.id,
        );
        return resourceConflict || memoryHate || civ.aggression > 0.55;
      });
      if (rival && rng.chance(0.05 + civ.aggression * 0.1)) {
        const regionId = rival.capitalRegionId;
        state.wars.push({
          id: `war_${civ.id}_${rival.id}_${state.tick}`,
          aId: civ.id,
          bId: rival.id,
          regionId,
          strength: (civ.military + civ.techLevel) / (rival.military + rival.techLevel + 0.01),
          startedTick: state.tick,
          active: true,
        });
        civ.enemyIds.push(rival.id);
        rival.enemyIds.push(civ.id);
        rival.memory.push({
          tick: state.tick,
          kind: "attacked_by",
          targetId: civ.id,
          note: "prior_aggression",
        });
        events.push({
          id: eventId(state.seed, state.tick, `war_${civ.id}_${rival.id}`),
          type: "WAR_STARTED",
          title: `صراع: ${civ.name} ضد ${rival.name}`,
          titleEn: `Conflict: ${civ.nameEn} vs ${rival.nameEn}`,
          summary: "اندلعت حرب بسبب نزاع موارد وتاريخ عداء وتوازن قوى محسوب.",
          summaryEn: "War erupted from resource rivalry, hostility memory, and power balance.",
          tick: state.tick,
          year: state.year,
          importance: 0.95,
          regionId,
          lat: regionById(state, regionId)?.lat,
          lng: regionById(state, regionId)?.lng,
          causes: ["resource_rivalry", "hostility_memory", "power_balance"],
          effects: [
            {
              domain: "wars",
              metric: "active_wars",
              delta: 1,
              confidence: 0.95,
              explanationKey: "war_started",
            },
          ],
          confidence: 0.95,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (action === "expand" && capital && rng.chance(0.12)) {
      const targets = state.regions.filter(
        (r) =>
          r.biome !== "ocean" &&
          r.id !== capital.id &&
          r.fertility > 0.35 &&
          r.population < r.carryingCapacity * 0.5,
      );
      if (targets.length) {
        const target = rng.pick(targets);
        const path = dijkstra(graph, capital.id, target.id);
        if (path && path.cost < 12) {
          const migrants = Math.floor(civ.population * 0.02);
          state.migrations.push({
            id: `mig_${civ.id}_${state.tick}`,
            fromRegionId: capital.id,
            toRegionId: target.id,
            population: migrants,
            startedTick: state.tick,
            active: true,
            reason: "expansion",
          });
          target.population = Math.min(
            target.carryingCapacity,
            target.population + migrants,
          );
          target.civilizationId = civ.id;
          events.push({
            id: eventId(state.seed, state.tick, `mig_${civ.id}`),
            type: "MIGRATION_STARTED",
            title: `هجرة من ${civ.name}`,
            titleEn: `Migration from ${civ.nameEn}`,
            summary: "بدأت هجرة منظمة عبر مسار محسوب نحو أراضٍ أكثر خصوبة.",
            summaryEn: "An organized migration began along a computed path to fertile land.",
            tick: state.tick,
            year: state.year,
            importance: 0.6,
            regionId: target.id,
            lat: target.lat,
            lng: target.lng,
            causes: ["population_pressure", "fertile_land"],
            effects: [
              {
                domain: "migrations",
                metric: "active_migrations",
                delta: 1,
                confidence: 0.85,
                explanationKey: "migration_started",
              },
            ],
            confidence: 0.85,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    if (action === "trade" && rng.chance(0.15)) {
      const other = rng.pick(state.civilizations.filter((c) => c.id !== civ.id));
      const fromCity = state.cities.find((c) => c.civilizationId === civ.id);
      const toCity = state.cities.find((c) => c.civilizationId === other.id);
      if (fromCity && toCity) {
        const fromRegion = regionById(state, fromCity.regionId)!;
        const toRegion = regionById(state, toCity.regionId)!;
        const path = dijkstra(graph, fromRegion.id, toRegion.id);
        if (path) {
          state.tradeRoutes.push({
            id: `trade_${fromCity.id}_${toCity.id}_${state.tick}`,
            fromCityId: fromCity.id,
            toCityId: toCity.id,
            risk: Math.min(1, path.cost / 20),
            value: (civ.economy + other.economy) / 2,
          });
          civ.economy = clamp(civ.economy + 0.02);
          other.economy = clamp(other.economy + 0.015);
          events.push({
            id: eventId(state.seed, state.tick, `trade_${fromCity.id}_${toCity.id}`),
            type: "TRADE_ROUTE_CREATED",
            title: "طريق تجاري جديد",
            titleEn: "New trade route",
            summary: "أُنشئ طريق تجاري عبر أقصر مسار آمن محسوب بين مدينتين.",
            summaryEn: "A trade route was created along the safest computed path.",
            tick: state.tick,
            year: state.year,
            importance: 0.55,
            causes: ["economic_opportunity", "pathfinding"],
            effects: [
              {
                domain: "economy",
                metric: "trade_value",
                delta: 0.02,
                confidence: 0.8,
                explanationKey: "trade_route",
              },
            ],
            confidence: 0.8,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // resolve some wars
  for (const war of state.wars.filter((w) => w.active)) {
    if (state.tick - war.startedTick > 3 || rng.chance(0.25)) {
      war.active = false;
      const winner = war.strength >= 1 ? war.aId : war.bId;
      const loser = winner === war.aId ? war.bId : war.aId;
      const wCiv = state.civilizations.find((c) => c.id === winner);
      const lCiv = state.civilizations.find((c) => c.id === loser);
      if (wCiv && lCiv) {
        lCiv.population = Math.floor(lCiv.population * 0.92);
        lCiv.stability = clamp(lCiv.stability - 0.1);
        wCiv.economy = clamp(wCiv.economy + 0.03);
        events.push({
          id: eventId(state.seed, state.tick, `war_end_${war.id}`),
          type: "WAR_ENDED",
          title: `انتهاء حرب ${wCiv.name}`,
          titleEn: `War ended for ${wCiv.nameEn}`,
          summary: "انتهت الحرب بنتائج محسوبة من القوة والتقنية والإمداد.",
          summaryEn: "War ended with outcomes derived from force, tech, and logistics.",
          tick: state.tick,
          year: state.year,
          importance: 0.85,
          regionId: war.regionId,
          causes: ["military_resolution"],
          effects: [
            {
              domain: "wars",
              metric: "active_wars",
              delta: -1,
              confidence: 0.9,
              explanationKey: "war_ended",
            },
          ],
          confidence: 0.9,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
}

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

export function advanceTicks(state: WorldState, ticks: number): TickResult {
  let current = cloneState(state);
  const allEvents: WorldEventDto[] = [];
  const allEffects: SimulationEffect[] = [];

  for (let i = 0; i < ticks; i++) {
    current.tick += 1;
    current.year += current.tickUnit === "decade" ? 10 : 1;
    const rng = new SeededRng(hashString(`${current.seed}:${current.tick}`));
    const effects: SimulationEffect[] = [];
    const events: WorldEventDto[] = [];

    updateClimate(current, rng, effects);
    updateEcology(current, rng, events, effects);
    updateCivilizations(current, rng, events, effects);

    // contribution long-tail effects
    for (const contrib of current.contributions) {
      const age = current.tick - contrib.appliedTick;
      if (age > 0 && age % 10 === 0) {
        const plant = current.plants.find((p) => p.contributionId === contrib.id);
        if (plant) {
          plant.coverage = clamp(plant.coverage + 0.03);
          for (const region of current.regions) {
            if (plant.preferredBiomes.includes(region.biome) && rng.chance(0.08)) {
              region.pollution = clamp(region.pollution - (plant.pollutionAbsorption ?? 0) * 0.05);
              if (!region.plantIds.includes(plant.id)) region.plantIds.push(plant.id);
            }
          }
          events.push({
            id: eventId(current.seed, current.tick, `spread_${contrib.id}_${age}`),
            type: "PLANT_SPREAD",
            title: `انتشار ${plant.name}`,
            titleEn: `Spread of ${plant.nameEn}`,
            summary: `امتد تأثير ${plant.name} إلى مناطق جديدة بعد ${age} سنة.`,
            summaryEn: `${plant.nameEn} spread further after ${age} years.`,
            tick: current.tick,
            year: current.year,
            importance: 0.7,
            causes: [`contribution:${contrib.id}`, "habitat_suitability"],
            effects: [
              {
                domain: "plants",
                metric: "coverage",
                delta: 0.03,
                confidence: 0.8,
                explanationKey: "plant_spread",
              },
            ],
            confidence: 0.8,
            contributionId: contrib.id,
            userId: contrib.userId,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    current.eventLog.push(...events);
    allEvents.push(...events);
    allEffects.push(...effects);
  }

  return {
    state: current,
    events: allEvents,
    effects: allEffects,
    causalGraph: buildCausalGraph("tick_advance", allEffects.slice(0, 12)),
  };
}

export function runMonteCarloForecast(
  state: WorldState,
  horizons: number[],
  samples = 8,
): Array<{
  horizonYears: number;
  paths: TickResult[];
}> {
  return horizons.map((horizon) => {
    const paths: TickResult[] = [];
    for (let s = 0; s < samples; s++) {
      const forked = cloneState(state);
      // salt seed stream via synthetic contribution age offset for variance while remaining deterministic per sample index
      forked.seed = hashString(`${state.seed}:mc:${horizon}:${s}`);
      paths.push(advanceTicks(forked, horizon));
    }
    return { horizonYears: horizon, paths };
  });
}
