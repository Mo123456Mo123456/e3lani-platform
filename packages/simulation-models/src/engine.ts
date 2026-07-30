import {
  type CausalLink,
  type CivilizationEntity,
  type SimulationEvent,
  type TechnologyEntity,
  type WorldState,
} from "@kawkab/shared-types";

import {
  applyEvent,
  causeFromEvent,
  causeFromTick,
  createCausalLink,
  createEvent,
  createGenesisEvent,
  type EventDraft,
} from "./events.js";
import { hashHex, SeededRandom, type Seed } from "./prng.js";
import {
  generateWorld,
  type WorldGenerationOptions,
} from "./world-generation.js";

export interface SimulationStep {
  state: WorldState;
  events: SimulationEvent[];
  causalLinks: CausalLink[];
}

export interface SimulationInitialization extends SimulationStep {
  events: [SimulationEvent];
}

export interface TickOptions {
  /** Multiplies rare hazard probabilities; defaults to 1. */
  hazardScale?: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function initializeSimulation(
  seed: Seed,
  options: WorldGenerationOptions = {},
): SimulationInitialization {
  const world = generateWorld(seed, options);
  const genesis = createGenesisEvent(world);
  return {
    state: genesis.effects.replaceState as WorldState,
    events: [genesis],
    causalLinks: [],
  };
}

export function advanceTick(
  previousState: WorldState,
  options: TickOptions = {},
): SimulationStep {
  const nextTick = previousState.tick + 1;
  const hazardScale = clamp(options.hazardScale ?? 1, 0, 100);
  const random = new SeededRandom(`${previousState.seed}:tick:${nextTick}`);
  let state: WorldState = { ...previousState, tick: nextTick };
  const events: SimulationEvent[] = [];
  const causalLinks: CausalLink[] = [];
  const latestRegionEvent = new Map<string, SimulationEvent>();

  const emit = (
    draft: EventDraft,
    relationship: CausalLink["relationship"] = "BACKGROUND",
    strength = 0.7,
  ): SimulationEvent => {
    const event = createEvent(state, draft);
    state = applyEvent(state, event);
    events.push(event);
    if (event.regionId) latestRegionEvent.set(event.regionId, event);
    for (const cause of event.causes) {
      causalLinks.push(
        createCausalLink(
          cause.kind,
          cause.referenceId,
          event.id,
          relationship,
          strength,
          cause.explanation,
        ),
      );
    }
    return event;
  };

  const climateDrift =
    random.range(-0.025, 0.035) +
    Math.max(0, state.climate.atmosphericCarbonPpm - 280) * 0.00001;
  const nextClimate = {
    ...state.climate,
    globalMeanTemperatureC: round(
      clamp(state.climate.globalMeanTemperatureC + climateDrift, -100, 100),
    ),
    globalMeanMoisture: round(
      clamp(
        state.climate.globalMeanMoisture - climateDrift * 0.002,
        0,
        1,
      ),
    ),
  };
  emit({
    type: "CLIMATE_CHANGED",
    key: `climate:${nextTick}`,
    title: { ar: "تغيّر المناخ", en: "Climate changed" },
    description: {
      ar: "تذبذب مناخي طبيعي مبسّط في متوسط حرارة العالم",
      en: "A simplified natural fluctuation in global mean temperature",
    },
    causes: [causeFromTick(nextTick)],
    data: { temperatureDeltaC: round(climateDrift) },
    effects: { climate: nextClimate },
  });

  for (const initialRegion of state.regions) {
    const region = state.regions.find(({ id }) => id === initialRegion.id);
    if (!region || region.population <= 0 || region.carryingCapacity <= 0) {
      continue;
    }
    const density = region.population / region.carryingCapacity;
    const environmentalQuality = clamp(
      1 - region.pollution * 0.7 - Math.abs(region.temperatureC - 18) / 100,
      0.1,
      1,
    );
    const growth =
      region.population *
      0.008 *
      (1 - density) *
      environmentalQuality *
      random.range(0.9, 1.1);
    const nextPopulation = round(
      clamp(region.population + growth, 0, region.carryingCapacity),
    );
    if (Math.abs(nextPopulation - region.population) >= 0.000001) {
      emit({
        type: "POPULATION_CHANGED",
        regionId: region.id,
        key: `growth:${region.id}`,
        title: { ar: "تغيّر السكان", en: "Population changed" },
        description: {
          ar: "نمو لوجستي مبسّط تحدّه القدرة الاستيعابية",
          en: "Simplified logistic growth bounded by carrying capacity",
        },
        causes: [causeFromTick(nextTick)],
        data: { previous: region.population, next: nextPopulation },
        effects: {
          regionChanges: [
            { regionId: region.id, population: nextPopulation },
          ],
        },
      });
    }
  }

  for (const initialRegion of state.regions) {
    const region = state.regions.find(({ id }) => id === initialRegion.id);
    if (!region || region.pollution <= 0) continue;
    const naturalRemoval = 0.001 + region.moisture * 0.0005;
    const nextPollution = round(clamp(region.pollution - naturalRemoval, 0, 1));
    if (nextPollution !== region.pollution) {
      emit({
        type: "POLLUTION_CHANGED",
        regionId: region.id,
        key: `decay:${region.id}`,
        title: { ar: "انخفض التلوث", en: "Pollution declined" },
        description: {
          ar: "أزالت العمليات الطبيعية جزءاً صغيراً من التلوث",
          en: "Natural processes removed a small share of pollution",
        },
        causes: [causeFromTick(nextTick)],
        data: { previous: region.pollution, next: nextPollution },
        effects: {
          regionChanges: [{ regionId: region.id, pollution: nextPollution }],
        },
      });
    }
  }

  for (const initialRegion of state.regions) {
    const region = state.regions.find(({ id }) => id === initialRegion.id);
    if (!region || region.population <= 0 || region.carryingCapacity <= 0) {
      continue;
    }

    if (
      region.population / region.carryingCapacity > 0.9 &&
      random.chance(0.02 * hazardScale)
    ) {
      const destination = region.neighborIds
        .map((id) => state.regions.find((candidate) => candidate.id === id))
        .filter(
          (candidate): candidate is WorldState["regions"][number] =>
            Boolean(
              candidate &&
                candidate.carryingCapacity - candidate.population > 1,
            ),
        )
        .sort(
          (left, right) =>
            right.carryingCapacity -
            right.population -
            (left.carryingCapacity - left.population) ||
            left.id.localeCompare(right.id),
        )[0];
      if (destination) {
        const migrants = Math.min(
          region.population * 0.02,
          destination.carryingCapacity - destination.population,
        );
        const prior = latestRegionEvent.get(region.id);
        emit(
          {
            type: "MIGRATION_STARTED",
            regionId: region.id,
            key: `migration:${region.id}:${destination.id}`,
            title: { ar: "بدأت هجرة", en: "Migration started" },
            description: {
              ar: "انتقل بعض السكان نحو منطقة أقل ازدحاماً",
              en: "Part of the population moved to a less crowded region",
            },
            causes: [prior ? causeFromEvent(prior) : causeFromTick(nextTick)],
            data: { destinationRegionId: destination.id, migrants: round(migrants) },
            effects: {
              regionChanges: [
                {
                  regionId: region.id,
                  population: round(region.population - migrants),
                },
                {
                  regionId: destination.id,
                  population: round(destination.population + migrants),
                },
              ],
            },
          },
          "SECONDARY",
          0.85,
        );
      }
    }

    if (random.chance(0.002 * hazardScale)) {
      const current = state.regions.find(({ id }) => id === region.id);
      if (current && current.population > 0) {
        const lossFraction = random.range(0.005, 0.04);
        const nextPopulation = round(current.population * (1 - lossFraction));
        const prior = latestRegionEvent.get(region.id);
        emit(
          {
            type: "DISEASE_OUTBREAK",
            regionId: region.id,
            key: `disease:${region.id}`,
            title: { ar: "تفشّي مرض", en: "Disease outbreak" },
            description: {
              ar: "خفض تفشٍّ مبسّط عدد السكان مؤقتاً",
              en: "A simplified outbreak temporarily reduced population",
            },
            causes: [prior ? causeFromEvent(prior) : causeFromTick(nextTick)],
            data: { lossFraction: round(lossFraction) },
            effects: {
              regionChanges: [
                { regionId: region.id, population: nextPopulation },
              ],
            },
          },
          "SECONDARY",
          0.9,
        );
      }
    }
  }

  for (const initialRegion of state.regions) {
    const region = state.regions.find(({ id }) => id === initialRegion.id);
    if (
      !region ||
      region.biome === "OCEAN" ||
      region.biome === "ICE" ||
      !random.chance(0.0008 * hazardScale)
    ) {
      continue;
    }
    const populationLoss = region.population * random.range(0.005, 0.08);
    emit({
      type: "VOLCANO_ERUPTED",
      regionId: region.id,
      key: `volcano:${region.id}`,
      title: { ar: "ثار بركان", en: "Volcano erupted" },
      description: {
        ar: "ثوران مبسّط رفع التضاريس وأثر في السكان والتلوث",
        en: "A simplified eruption raised terrain and affected population and pollution",
      },
      causes: [causeFromTick(nextTick)],
      data: { populationLoss: round(populationLoss) },
      effects: {
        regionChanges: [
          {
            regionId: region.id,
            population: round(Math.max(0, region.population - populationLoss)),
            elevation: round(clamp(region.elevation + 0.015, -1, 1)),
            pollution: round(clamp(region.pollution + 0.04, 0, 1)),
          },
        ],
      },
    });
  }

  for (const resource of state.resources) {
    if (
      resource.depleted ||
      resource.renewability >= 1 ||
      !random.chance(
        0.001 *
          (1 - resource.renewability) *
          (0.5 + resource.strategicValue) *
          hazardScale,
      )
    ) {
      continue;
    }
    emit({
      type: "RESOURCE_DEPLETED",
      regionId: resource.regionId,
      key: `resource:${resource.id}`,
      title: { ar: "نضب مورد", en: "Resource depleted" },
      description: {
        ar: "أصبح المورد غير المتجدد غير متاح",
        en: "The non-renewable resource became unavailable",
      },
      causes: [causeFromTick(nextTick)],
      data: { resourceId: resource.id },
      effects: {
        resourceChanges: [
          { resourceId: resource.id, abundance: 0, depleted: true },
        ],
      },
    });
  }

  evolveCivilizations(state, random, nextTick, hazardScale, emit);

  return { state, events, causalLinks };
}

function evolveCivilizations(
  inputState: WorldState,
  random: SeededRandom,
  tick: number,
  hazardScale: number,
  emit: (
    draft: EventDraft,
    relationship?: CausalLink["relationship"],
    strength?: number,
  ) => SimulationEvent,
): void {
  const civilizations = [...inputState.civilizations].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const civilization of civilizations) {
    if (random.chance(0.003 * civilization.technologyLevel * hazardScale)) {
      const technologyId = `technology:auto:${tick}:${hashHex(civilization.id)}`;
      const technology: TechnologyEntity = {
        id: technologyId,
        name: {
          ar: `ابتكار ${tick}`,
          en: `Innovation ${tick}`,
        },
        regionId: civilization.capitalRegionId,
        civilizationId: civilization.id,
        domain: random.pick([
          "AGRICULTURE",
          "MEDICINE",
          "ENERGY",
          "TRANSPORT",
          "COMMUNICATION",
          "MATERIALS",
        ] as const),
        effectiveness: round(random.range(0.2, 0.8)),
        pollutionEffect: round(random.range(-0.2, 0.2)),
        populationEffect: round(random.range(-0.05, 0.2)),
      };
      emit({
        type: "TECHNOLOGY_DISCOVERED",
        regionId: civilization.capitalRegionId,
        key: `automatic-technology:${civilization.id}`,
        title: { ar: "اكتُشفت تقنية", en: "Technology discovered" },
        description: {
          ar: "أنتج التطور الحضاري ابتكاراً جديداً",
          en: "Civilizational development produced a new innovation",
        },
        causes: [causeFromTick(tick)],
        data: { civilizationId: civilization.id, technologyId },
        effects: {
          addTechnologies: [technology],
          civilizationChanges: [
            {
              civilizationId: civilization.id,
              technologyIds: [...civilization.technologyIds, technologyId],
              technologyLevel: round(
                clamp(civilization.technologyLevel + 0.01, 0, 1),
              ),
            },
          ],
        },
      });
    }
  }

  for (let leftIndex = 0; leftIndex < civilizations.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < civilizations.length;
      rightIndex += 1
    ) {
      const left = civilizations[leftIndex] as CivilizationEntity;
      const right = civilizations[rightIndex] as CivilizationEntity;
      const atWar = left.atWarWithCivilizationIds.includes(right.id);
      const allied = left.alliedCivilizationIds.includes(right.id);
      const pairKey = `${left.id}:${right.id}`;

      if (atWar && random.chance(0.01 * hazardScale)) {
        emit({
          type: "WAR_ENDED",
          regionId: left.capitalRegionId,
          key: `peace:${pairKey}`,
          title: { ar: "انتهت حرب", en: "War ended" },
          description: {
            ar: "أنهت الحضارتان صراعهما",
            en: "The two civilizations ended their conflict",
          },
          causes: [causeFromTick(tick)],
          data: { civilizationIds: [left.id, right.id] },
          effects: {
            civilizationChanges: [
              {
                civilizationId: left.id,
                atWarWithCivilizationIds:
                  left.atWarWithCivilizationIds.filter((id) => id !== right.id),
              },
              {
                civilizationId: right.id,
                atWarWithCivilizationIds:
                  right.atWarWithCivilizationIds.filter((id) => id !== left.id),
              },
            ],
          },
        });
      } else if (!atWar && !allied && random.chance(0.001 * hazardScale)) {
        emit({
          type: "WAR_STARTED",
          regionId: left.capitalRegionId,
          key: `war:${pairKey}`,
          title: { ar: "بدأت حرب", en: "War started" },
          description: {
            ar: "دخلت حضارتان في صراع مبسّط",
            en: "Two civilizations entered a simplified conflict",
          },
          causes: [causeFromTick(tick)],
          data: { civilizationIds: [left.id, right.id] },
          effects: {
            civilizationChanges: [
              {
                civilizationId: left.id,
                atWarWithCivilizationIds: [
                  ...left.atWarWithCivilizationIds,
                  right.id,
                ],
              },
              {
                civilizationId: right.id,
                atWarWithCivilizationIds: [
                  ...right.atWarWithCivilizationIds,
                  left.id,
                ],
              },
            ],
          },
        });
      } else if (!atWar && !allied && random.chance(0.002 * hazardScale)) {
        emit({
          type: "ALLIANCE_CREATED",
          regionId: left.capitalRegionId,
          key: `alliance:${pairKey}`,
          title: { ar: "نشأ تحالف", en: "Alliance created" },
          description: {
            ar: "أسست حضارتان تحالفاً متبادلاً",
            en: "Two civilizations established a mutual alliance",
          },
          causes: [causeFromTick(tick)],
          data: { civilizationIds: [left.id, right.id] },
          effects: {
            civilizationChanges: [
              {
                civilizationId: left.id,
                alliedCivilizationIds: [
                  ...left.alliedCivilizationIds,
                  right.id,
                ],
              },
              {
                civilizationId: right.id,
                alliedCivilizationIds: [
                  ...right.alliedCivilizationIds,
                  left.id,
                ],
              },
            ],
          },
        });
      } else if (!atWar && random.chance(0.003 * hazardScale)) {
        emit({
          type: "TRADE_ROUTE_CREATED",
          regionId: left.capitalRegionId,
          key: `trade:${pairKey}`,
          title: { ar: "افتُتح طريق تجاري", en: "Trade route created" },
          description: {
            ar: "بدأ تبادل اقتصادي بين حضارتين",
            en: "Economic exchange began between two civilizations",
          },
          causes: [causeFromTick(tick)],
          data: { civilizationIds: [left.id, right.id] },
          effects: {},
        });
      }
    }
  }
}

export function advanceTicks(
  initialState: WorldState,
  count: number,
  options: TickOptions = {},
): SimulationStep {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("tick count must be a non-negative integer");
  }
  let state = initialState;
  const events: SimulationEvent[] = [];
  const causalLinks: CausalLink[] = [];
  for (let index = 0; index < count; index += 1) {
    const step = advanceTick(state, options);
    state = step.state;
    events.push(...step.events);
    causalLinks.push(...step.causalLinks);
  }
  return { state, events, causalLinks };
}
