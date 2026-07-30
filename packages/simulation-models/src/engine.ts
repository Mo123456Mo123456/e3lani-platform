import type {
  ContributionAnalysis,
  DeltaUpdate,
  PlanetRegion,
  UserContribution,
  WorldEvent,
  WorldState,
} from "@planet/shared-types";
import { clamp, round, SeededRandom } from "./prng.js";
import { createEvent, stateChecksum } from "./world-generator.js";

type RegionDelta = Partial<
  Pick<
    PlanetRegion,
    | "vegetation"
    | "pollution"
    | "water"
    | "fertility"
    | "temperature"
    | "population"
  >
>;

function cloneState(state: WorldState): WorldState {
  return structuredClone(state);
}

function recalculatePlanet(state: WorldState): void {
  const land = state.regions.filter((region) => region.biome !== "ocean");
  state.planet.globalTemperature = round(
    state.regions.reduce((sum, region) => sum + region.temperature, 0) /
      state.regions.length,
  );
  state.planet.globalPollution = round(
    land.reduce((sum, region) => sum + region.pollution, 0) /
      Math.max(1, land.length),
  );
  state.planet.biodiversity = Math.max(
    0,
    Math.round(
      land.reduce(
        (sum, region) => sum + region.vegetation * (1 - region.pollution),
        0,
      ) * 24,
    ),
  );
  state.planet.population = state.civilizations.reduce(
    (sum, civilization) => sum + civilization.population,
    0,
  );
  state.planet.civilizationCount = state.civilizations.length;
  state.planet.contributionCount = state.contributions.length;
  state.planet.eventCount = Math.max(
    state.planet.eventCount,
    state.latestEvents.at(-1)?.sequence ?? state.planet.eventCount,
  );
}

export function applyEvent(state: WorldState, event: WorldEvent): WorldState {
  const next = cloneState(state);
  const payload = event.payload as {
    contribution?: UserContribution;
    regionDelta?: RegionDelta;
  };

  if (event.type === "CONTRIBUTION_ADDED" && payload.contribution) {
    const exists = next.contributions.some(
      (item) => item.id === payload.contribution?.id,
    );
    if (!exists) next.contributions.push(payload.contribution);
  }

  if (event.regionId && payload.regionDelta) {
    const region = next.regions.find((item) => item.id === event.regionId);
    if (region) {
      for (const [key, delta] of Object.entries(payload.regionDelta) as Array<
        [keyof RegionDelta, number]
      >) {
        const current = region[key];
        if (typeof current === "number") {
          const value = current + delta;
          if (key === "population") {
            region.population = Math.round(
              clamp(value, 0, Math.max(0, region.carryingCapacity)),
            );
          } else {
            (region[key] as number) = round(clamp(value));
          }
        }
      }
    }
  }

  if (!next.latestEvents.some((item) => item.id === event.id)) {
    next.latestEvents.push(event);
    next.latestEvents = next.latestEvents.slice(-250);
  }
  next.planet.tick = Math.max(next.planet.tick, event.tick);
  next.planet.year = Math.max(next.planet.year, event.year);
  recalculatePlanet(next);
  next.checksum = stateChecksum(next);
  return next;
}

function contributionId(
  seed: string,
  ownerId: string,
  tick: number,
  name: string,
): string {
  const random = new SeededRandom(`${seed}:${ownerId}:${tick}:${name}`);
  return `contrib_${Math.floor(random.next() * 0xffffffff)
    .toString(16)
    .padStart(8, "0")}`;
}

function nextEventSequence(state: WorldState): number {
  return (
    Math.max(
      state.planet.eventCount,
      state.latestEvents.at(-1)?.sequence ?? 0,
    ) + 1
  );
}

export function addContribution(
  state: WorldState,
  ownerId: string,
  analysis: ContributionAnalysis,
  regionId: string,
): { state: WorldState; events: WorldEvent[]; delta: DeltaUpdate } {
  if (!analysis.moderation.accepted)
    throw new Error("CONTRIBUTION_REJECTED_BY_MODERATION");
  const region = state.regions.find((item) => item.id === regionId);
  if (!region) throw new Error("REGION_NOT_FOUND");
  if (region.biome === "ocean" && !analysis.possibleBiomes.includes("ocean")) {
    throw new Error("INCOMPATIBLE_START_REGION");
  }

  const contribution: UserContribution = {
    id: contributionId(
      state.planet.seed,
      ownerId,
      state.planet.tick,
      analysis.name,
    ),
    ownerId,
    category: analysis.category,
    name: analysis.name,
    description: analysis.description,
    traits: analysis.traits,
    possibleBiomes: analysis.possibleBiomes,
    risks: analysis.risks,
    regionId,
    createdAtTick: state.planet.tick,
    status: "active",
  };

  let sequence = nextEventSequence(state);
  const events: WorldEvent[] = [];
  const addedEvent = createEvent(state.planet.seed, sequence++, {
    tick: state.planet.tick,
    year: state.planet.year,
    type: "CONTRIBUTION_ADDED",
    cause: "user_confirmed_balanced_contribution",
    regionId,
    contributionId: contribution.id,
    actorIds: [ownerId],
    confidence: 1,
    directImpact: {},
    payload: { contribution },
    titleAr: `إضافة ${contribution.name} إلى العالم`,
    titleEn: `${contribution.name} entered the world`,
    descriptionAr:
      "اجتازت الإضافة التحقق والتوازن وبدأ أثرها من المنطقة المختارة.",
    descriptionEn:
      "The contribution passed validation and balancing, and started in the selected region.",
  });
  events.push(addedEvent);

  const vegetationDelta = round(
    analysis.traits.growthRate * region.fertility * 0.045,
  );
  if (vegetationDelta > 0.005 && analysis.category === "plant") {
    events.push(
      createEvent(state.planet.seed, sequence++, {
        tick: state.planet.tick,
        year: state.planet.year,
        type: "VEGETATION_EXPANDED",
        cause: "growth_rate_x_soil_fertility",
        regionId,
        contributionId: contribution.id,
        actorIds: [contribution.id],
        confidence: 0.94,
        directImpact: { vegetation: vegetationDelta },
        payload: {
          causeEventId: addedEvent.id,
          regionDelta: { vegetation: vegetationDelta },
          formula: "growthRate * fertility * 0.045",
        },
        titleAr: `بدأ ${contribution.name} بالانتشار`,
        titleEn: `${contribution.name} started spreading`,
        descriptionAr: "سمحت خصوبة التربة ومعدل النمو بزيادة الغطاء النباتي.",
        descriptionEn:
          "Soil fertility and growth rate increased vegetation cover.",
      }),
    );
  }

  const pollutionDelta = round(
    -Math.min(region.pollution, analysis.traits.pollutionAbsorption * 0.028),
  );
  if (pollutionDelta < -0.001) {
    events.push(
      createEvent(state.planet.seed, sequence++, {
        tick: state.planet.tick,
        year: state.planet.year,
        type: "POLLUTION_REDUCED",
        cause: "pollution_absorption_trait",
        regionId,
        contributionId: contribution.id,
        actorIds: [contribution.id],
        confidence: 0.91,
        directImpact: { pollution: pollutionDelta },
        payload: {
          causeEventId: addedEvent.id,
          regionDelta: { pollution: pollutionDelta },
          formula: "min(currentPollution, absorption * 0.028)",
        },
        titleAr: `انخفض التلوث بفعل ${contribution.name}`,
        titleEn: `${contribution.name} reduced pollution`,
        descriptionAr: "امتص العنصر جزءًا محسوبًا من ملوثات المنطقة.",
        descriptionEn:
          "The contribution absorbed a calculated share of regional pollutants.",
      }),
    );
  }

  const waterDelta = round(
    -analysis.traits.waterNeed *
      analysis.traits.size *
      (0.012 + analysis.traits.growthRate * 0.008),
  );
  if (waterDelta < -0.006) {
    events.push(
      createEvent(state.planet.seed, sequence++, {
        tick: state.planet.tick,
        year: state.planet.year,
        type: "WATER_STRESS_INCREASED",
        cause: "water_need_x_biomass",
        regionId,
        contributionId: contribution.id,
        actorIds: [contribution.id],
        confidence: 0.9,
        directImpact: { water: waterDelta },
        payload: {
          causeEventId: addedEvent.id,
          regionDelta: { water: waterDelta },
          formula: "waterNeed * size * (0.012 + growthRate * 0.008)",
        },
        titleAr: `ازداد الضغط على مياه ${region.nameAr}`,
        titleEn: `Water stress increased in ${region.nameEn}`,
        descriptionAr:
          "رفع الاحتياج المائي والكتلة الحيوية استهلاك المياه السطحية.",
        descriptionEn:
          "Water demand and biomass increased surface-water consumption.",
      }),
    );
  }

  let next = state;
  for (const event of events) next = applyEvent(next, event);
  const changedRegion = next.regions.find((item) => item.id === regionId)!;
  const delta: DeltaUpdate = {
    sequence: events.at(-1)!.sequence,
    tick: next.planet.tick,
    planet: next.planet,
    changedRegions: [
      {
        id: regionId,
        vegetation: changedRegion.vegetation,
        pollution: changedRegion.pollution,
        water: changedRegion.water,
      },
    ],
    events,
  };
  return { state: next, events, delta };
}

export function runTick(
  state: WorldState,
  yearsPerTick: 1 | 10 = 1,
): { state: WorldState; events: WorldEvent[]; delta: DeltaUpdate } {
  let next = cloneState(state);
  const tick = state.planet.tick + 1;
  const year = state.planet.year + yearsPerTick;
  const changedRegions = new Map<
    string,
    DeltaUpdate["changedRegions"][number]
  >();
  const markChanged = (
    regionId: string,
    patch: Omit<DeltaUpdate["changedRegions"][number], "id">,
  ) => {
    changedRegions.set(regionId, {
      ...changedRegions.get(regionId),
      ...patch,
      id: regionId,
    });
  };
  const events: WorldEvent[] = [];
  let sequence = nextEventSequence(state);

  for (const region of next.regions) {
    if (region.biome === "ocean") continue;
    const random = new SeededRandom(
      `${state.planet.seed}:tick:${tick}:${region.id}`,
    );
    const seasonalMoisture =
      (region.precipitation - 0.5) * 0.002 * yearsPerTick;
    const pollutionWarming = region.pollution * 0.0015 * yearsPerTick;
    const volcanicForcing =
      region.biome === "volcanic" ? 0.0004 * yearsPerTick : 0;
    const boundedWeather = (random.next() - 0.5) * 0.0006 * yearsPerTick;
    const temperatureBefore = region.temperature;
    const waterBefore = region.water;
    const vegetationBefore = region.vegetation;
    region.temperature = round(
      clamp(
        region.temperature +
          pollutionWarming +
          volcanicForcing +
          boundedWeather,
      ),
    );
    region.water = round(
      clamp(
        region.water +
          seasonalMoisture -
          Math.max(0, region.temperature - 0.72) * 0.001,
      ),
    );
    region.vegetation = round(
      clamp(
        region.vegetation +
          (region.fertility * region.water - region.vegetation) *
            0.003 *
            yearsPerTick -
          region.pollution * 0.001 * yearsPerTick,
      ),
    );

    if (
      region.temperature !== temperatureBefore ||
      region.water !== waterBefore ||
      region.vegetation !== vegetationBefore
    ) {
      markChanged(region.id, {
        temperature: region.temperature,
        water: region.water,
        vegetation: region.vegetation,
      });
    }
  }

  for (const contribution of next.contributions) {
    const region = next.regions.find(
      (item) => item.id === contribution.regionId,
    );
    if (!region) continue;
    const growth =
      contribution.traits.growthRate *
      contribution.traits.adaptability *
      region.fertility *
      yearsPerTick;
    region.vegetation = round(clamp(region.vegetation + growth * 0.002));
    region.water = round(
      clamp(
        region.water -
          contribution.traits.waterNeed *
            contribution.traits.size *
            yearsPerTick *
            0.0007,
      ),
    );
    region.pollution = round(
      clamp(
        region.pollution -
          contribution.traits.pollutionAbsorption * yearsPerTick * 0.0009,
      ),
    );
    markChanged(region.id, {
      vegetation: region.vegetation,
      water: region.water,
      pollution: region.pollution,
    });
  }

  for (const civilization of next.civilizations) {
    const region = next.regions.find(
      (item) => item.id === civilization.regionId,
    );
    if (!region) continue;
    const climatePenalty = Math.max(
      0,
      Math.abs(region.temperature - 0.55) - 0.25,
    );
    const effectiveCapacity = Math.max(
      1,
      Math.round(
        region.carryingCapacity *
          (1 - climatePenalty) *
          (1 - region.pollution * 0.5),
      ),
    );
    const logisticGrowth =
      civilization.population *
      0.006 *
      yearsPerTick *
      (1 - civilization.population / effectiveCapacity);
    civilization.population = Math.max(
      0,
      Math.min(
        effectiveCapacity,
        Math.round(civilization.population + logisticGrowth),
      ),
    );
    region.population = civilization.population;
    civilization.pollution = round(
      clamp(
        civilization.pollution +
          civilization.economy * 0.0004 * yearsPerTick -
          civilization.technology * 0.00015,
      ),
    );
    region.pollution = round(
      clamp(region.pollution + civilization.pollution * 0.0005 * yearsPerTick),
    );
    markChanged(region.id, {
      population: region.population,
      pollution: region.pollution,
    });
  }

  next.planet.tick = tick;
  next.planet.year = year;
  next.planet.status = "running";

  const averageTemperature =
    next.regions.reduce((sum, region) => sum + region.temperature, 0) /
    next.regions.length;
  if (
    tick % 10 === 0 &&
    Math.abs(averageTemperature - state.planet.globalTemperature) >= 0.0001
  ) {
    const event = createEvent(state.planet.seed, sequence++, {
      tick,
      year,
      type: "CLIMATE_CHANGED",
      cause: "aggregate_pollution_vegetation_and_volcanic_forcing",
      actorIds: [],
      confidence: 0.88,
      directImpact: {
        globalTemperature: round(
          averageTemperature - state.planet.globalTemperature,
          6,
        ),
      },
      payload: {
        previousTemperature: state.planet.globalTemperature,
        currentTemperature: round(averageTemperature),
      },
      titleAr: "سُجل تغير مناخي قابل للقياس",
      titleEn: "A measurable climate shift was recorded",
      descriptionAr:
        "تراكم أثر التلوث والغطاء النباتي والنشاط البركاني خلال عشر دورات.",
      descriptionEn:
        "Pollution, vegetation, and volcanic forcing accumulated over ten ticks.",
    });
    events.push(event);
    next.latestEvents.push(event);
  }

  next.latestEvents = next.latestEvents.slice(-250);
  recalculatePlanet(next);
  next.checksum = stateChecksum(next);
  return {
    state: next,
    events,
    delta: {
      sequence: events.at(-1)?.sequence ?? state.planet.eventCount,
      tick,
      planet: next.planet,
      changedRegions: [...changedRegions.values()],
      events,
    },
  };
}

export function replayEvents(
  initial: WorldState,
  events: WorldEvent[],
): WorldState {
  return [...events]
    .sort((a, b) => a.sequence - b.sequence)
    .reduce((state, event) => applyEvent(state, event), cloneState(initial));
}
