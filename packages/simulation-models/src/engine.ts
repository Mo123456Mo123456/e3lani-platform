import type {
  CivilizationState,
  ContributionAnalysis,
  PlanetRegion,
  SpeciesState,
  WorldDelta,
  WorldEvent,
  WorldEventType,
  WorldState,
} from "@planet/shared-types";
import { SeededRandom } from "./random.js";
import { deterministicId } from "./world-generator.js";

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value));
const round = (value: number, precision = 6) =>
  Number(value.toFixed(precision));

function eventDate(tick: number): string {
  return new Date(Date.UTC(2000, 0, 1) + tick * 1_000).toISOString();
}

function makeEvent(
  state: WorldState,
  sequence: number,
  input: Omit<WorldEvent, "id" | "planetId" | "tick" | "year" | "createdAt">,
  advanceClock = true,
): WorldEvent {
  const eventTick = state.tick + (advanceClock ? 1 : 0);
  const eventYear = state.year + (advanceClock ? state.tickYears : 0);
  return {
    ...input,
    id: deterministicId(
      `${state.planetId}:event:${eventTick}:${state.version}:${sequence}:${input.type}:${input.regionId ?? "world"}`,
    ),
    planetId: state.planetId,
    tick: eventTick,
    year: eventYear,
    createdAt: eventDate(eventTick),
  };
}

function regionSuitability(
  region: PlanetRegion,
  species: SpeciesState,
): number {
  const temperatureFit =
    region.temperature >= 0.5
      ? 1 - Math.max(0, region.temperature - species.heatResistance)
      : 1 -
        Math.max(0, 0.5 - region.temperature - species.coldResistance * 0.5);
  const waterFit = 1 - Math.max(0, species.waterNeed - region.surfaceWater);
  return clamp(
    temperatureFit * 0.32 +
      waterFit * 0.28 +
      region.vegetation * 0.25 +
      (1 - region.pollution) * 0.15,
  );
}

function evolveRegion(
  region: PlanetRegion,
  neighbors: PlanetRegion[],
  state: WorldState,
  random: SeededRandom,
): PlanetRegion {
  if (region.biome === "ocean") return region;
  const neighborMoisture =
    neighbors.reduce((sum, neighbor) => sum + neighbor.moisture, 0) /
    Math.max(1, neighbors.length);
  const civilizationPollution = state.civilizations
    .filter((civilization) => civilization.regionId === region.id)
    .reduce(
      (sum, civilization) =>
        sum + civilization.population * civilization.technology * 0.00000012,
      0,
    );
  const volcanicPulse =
    region.biome === "volcanic" && random.chance(0.012)
      ? random.between(0.02, 0.08)
      : 0;
  const moisture = clamp(
    region.moisture + (neighborMoisture - region.moisture) * 0.015,
  );
  const pollution = clamp(
    region.pollution * 0.992 +
      civilizationPollution +
      volcanicPulse -
      region.vegetation * 0.0018,
  );
  const temperature = clamp(
    region.temperature +
      pollution * 0.0009 +
      volcanicPulse * 0.04 -
      region.vegetation * 0.0002,
  );
  const rainfall = clamp(region.rainfall + (moisture - region.rainfall) * 0.02);
  const carryingVegetation = clamp(
    region.fertility *
      moisture *
      (1 - pollution * 0.7) *
      (temperature > 0.12 ? 1 : 0.25),
  );
  const vegetation = clamp(
    region.vegetation + (carryingVegetation - region.vegetation) * 0.025,
  );
  return {
    ...region,
    moisture: round(moisture),
    pollution: round(pollution),
    temperature: round(temperature),
    rainfall: round(rainfall),
    vegetation: round(vegetation),
    surfaceWater: round(
      clamp(region.surfaceWater + rainfall * 0.003 - temperature * 0.0015),
    ),
  };
}

function evolveCivilization(
  civilization: CivilizationState,
  region: PlanetRegion,
  random: SeededRandom,
): CivilizationState {
  const carryingCapacity = Math.max(
    1_000,
    (region.fertility * 1_500_000 + (region.resources.water ?? 0) * 600_000) *
      (0.7 + civilization.technology),
  );
  const foodProduction =
    region.fertility *
    region.surfaceWater *
    (0.65 + civilization.technology * 0.7);
  const scarcity = clamp(civilization.population / carryingCapacity);
  const growthRate =
    0.018 * civilization.stability * civilization.food * (1 - scarcity) -
    region.pollution * 0.006;
  const population = Math.max(
    100,
    Math.round(civilization.population * (1 + growthRate)),
  );
  const innovationGain =
    civilization.innovation *
    civilization.stability *
    0.0015 *
    random.between(0.92, 1.08);
  const economy = clamp(
    civilization.economy +
      foodProduction * 0.003 +
      civilization.technology * 0.001 -
      scarcity * 0.0015,
  );
  return {
    ...civilization,
    population,
    food: round(
      clamp(civilization.food + (foodProduction - civilization.food) * 0.025),
    ),
    economy: round(economy),
    technology: round(clamp(civilization.technology + innovationGain)),
    military: round(
      clamp(
        civilization.military +
          civilization.aggression * scarcity * 0.001 -
          0.00025,
      ),
    ),
    stability: round(
      clamp(
        civilization.stability +
          (civilization.food - 0.4) * 0.002 -
          scarcity * 0.001,
      ),
    ),
    pollution: round(
      clamp(civilization.pollution + civilization.technology * 0.0004),
    ),
  };
}

function getNeighbors(regions: PlanetRegion[], index: number): PlanetRegion[] {
  const width = Math.max(1, Math.round(Math.sqrt(regions.length * 2)));
  const height = Math.ceil(regions.length / width);
  const x = index % width;
  const y = Math.floor(index / width);
  const positions = [
    [(x - 1 + width) % width, y],
    [(x + 1) % width, y],
    [x, Math.max(0, y - 1)],
    [x, Math.min(height - 1, y + 1)],
  ];
  return positions
    .map(
      ([neighborX, neighborY]) =>
        regions[(neighborY ?? 0) * width + (neighborX ?? 0)],
    )
    .filter((region): region is PlanetRegion => Boolean(region));
}

export function simulateTick(current: WorldState): {
  state: WorldState;
  delta: WorldDelta;
  events: WorldEvent[];
} {
  const random = new SeededRandom(`${current.seed}:tick:${current.tick + 1}`);
  const regions = current.regions.map((region, index) =>
    evolveRegion(region, getNeighbors(current.regions, index), current, random),
  );
  const regionMap = new Map(regions.map((region) => [region.id, region]));
  const civilizations = current.civilizations.map((civilization) =>
    evolveCivilization(
      civilization,
      regionMap.get(civilization.regionId) ?? current.regions[0]!,
      random,
    ),
  );
  const species = current.species
    .map((speciesState) => {
      const region = regionMap.get(speciesState.regionId);
      if (!region) return speciesState;
      const suitability = regionSuitability(region, speciesState);
      const capacity = Math.max(
        10,
        speciesState.carryingCapacity * suitability,
      );
      const growth =
        speciesState.reproductionRate *
        speciesState.population *
        (1 - speciesState.population / capacity);
      return {
        ...speciesState,
        population: Math.max(0, Math.round(speciesState.population + growth)),
      };
    })
    .filter((speciesState) => speciesState.population > 0);

  const changedRegions = regions
    .filter(
      (region, index) =>
        JSON.stringify(region) !== JSON.stringify(current.regions[index]),
    )
    .map((region) => ({ ...region }));
  const changedCivilizations = civilizations
    .filter(
      (civilization, index) =>
        JSON.stringify(civilization) !==
        JSON.stringify(current.civilizations[index]),
    )
    .map((civilization) => ({ ...civilization }));
  const next: WorldState = {
    ...current,
    version: current.version + 1,
    tick: current.tick + 1,
    year: current.year + current.tickYears,
    regions,
    civilizations,
    species,
  };

  const events: WorldEvent[] = [];
  const highPollutionRegion = regions.find(
    (region, index) =>
      region.pollution >= 0.25 &&
      (current.regions[index]?.pollution ?? 0) < 0.25,
  );
  if (highPollutionRegion) {
    events.push(
      makeEvent(current, events.length, {
        type: "POLLUTION_CHANGED",
        regionId: highPollutionRegion.id,
        cause: "Industrial emissions exceeded local vegetation absorption",
        actorIds: civilizations
          .filter(
            (civilization) => civilization.regionId === highPollutionRegion.id,
          )
          .map((civilization) => civilization.id),
        payload: { threshold: 0.25, pollution: highPollutionRegion.pollution },
        confidence: 0.94,
        directImpact: { pollution: highPollutionRegion.pollution },
        rootContributionId: null,
        causedByEventIds: [],
      }),
    );
  }
  events.push(
    makeEvent(current, events.length, {
      type: "TICK_COMPLETED",
      regionId: null,
      cause: "The deterministic simulation clock advanced by one tick",
      actorIds: [],
      payload: {
        statePatch: {
          version: next.version,
          tick: next.tick,
          year: next.year,
          changedRegions,
          changedCivilizations,
          species,
        },
      },
      confidence: 1,
      directImpact: {
        globalPopulation: civilizations.reduce(
          (sum, civilization) => sum + civilization.population,
          0,
        ),
      },
      rootContributionId: null,
      causedByEventIds: events.map((event) => event.id),
    }),
  );

  return {
    state: next,
    events,
    delta: {
      planetId: current.planetId,
      fromVersion: current.version,
      toVersion: next.version,
      tick: next.tick,
      year: next.year,
      changedRegions,
      changedCivilizations,
      events,
    },
  };
}

export function applyContribution(
  current: WorldState,
  contributionId: string,
  analysis: ContributionAnalysis,
  regionId: string,
): { state: WorldState; delta: WorldDelta; events: WorldEvent[] } {
  const regionIndex = current.regions.findIndex(
    (region) => region.id === regionId,
  );
  if (regionIndex === -1) throw new Error("Contribution region does not exist");
  const region = current.regions[regionIndex]!;
  const biomeFit = analysis.possibleBiomes.includes(region.biome) ? 1 : 0.24;
  const absorption = analysis.traits.pollutionAbsorption ?? 0;
  const waterNeed = analysis.traits.waterNeed ?? 0.35;
  const growthRate = analysis.traits.growthRate ?? 0.2;
  const changedRegion: PlanetRegion = {
    ...region,
    vegetation: round(clamp(region.vegetation + growthRate * biomeFit * 0.08)),
    pollution: round(clamp(region.pollution - absorption * biomeFit * 0.06)),
    surfaceWater: round(
      clamp(region.surfaceWater - waterNeed * biomeFit * 0.025),
    ),
  };
  const regions = [...current.regions];
  regions[regionIndex] = changedRegion;
  const next = { ...current, version: current.version + 1, regions };
  const added = makeEvent(
    current,
    0,
    {
      type: "CONTRIBUTION_ADDED",
      regionId,
      cause: "A validated user contribution was introduced into this region",
      actorIds: [contributionId],
      payload: {
        contributionId,
        category: analysis.category,
        name: analysis.name,
        biomeFit,
        regionPatch: changedRegion,
      },
      confidence: 1,
      directImpact: {
        vegetation: changedRegion.vegetation - region.vegetation,
        pollution: changedRegion.pollution - region.pollution,
        surfaceWater: changedRegion.surfaceWater - region.surfaceWater,
      },
      rootContributionId: contributionId,
      causedByEventIds: [],
    },
    false,
  );
  const secondaryTypes: Partial<
    Record<ContributionAnalysis["category"], WorldEventType>
  > = {
    plant: "VEGETATION_SPREAD",
    creature: "SPECIES_CREATED",
    resource: "RESOURCE_DISCOVERED",
    civilization: "CIVILIZATION_FOUNDED",
    invention: "TECHNOLOGY_DISCOVERED",
    natural_phenomenon: "CLIMATE_CHANGED",
    disease: "DISEASE_OUTBREAK",
  };
  const secondaryType = secondaryTypes[analysis.category];
  const secondary = secondaryType
    ? makeEvent(
        current,
        1,
        {
          type: secondaryType,
          regionId,
          cause: `${analysis.name} passed validation and habitat suitability was ${Math.round(
            biomeFit * 100,
          )}%`,
          actorIds: [contributionId],
          payload: {
            contributionId,
            biomeFit,
            possibleBiomes: analysis.possibleBiomes,
          },
          confidence: round(0.55 + biomeFit * 0.4),
          directImpact: {
            establishmentProbability: round(
              biomeFit * (0.6 + growthRate * 0.35),
            ),
          },
          rootContributionId: contributionId,
          causedByEventIds: [added.id],
        },
        false,
      )
    : null;
  const events = secondary ? [added, secondary] : [added];
  return {
    state: next,
    events,
    delta: {
      planetId: current.planetId,
      fromVersion: current.version,
      toVersion: next.version,
      tick: current.tick,
      year: current.year,
      changedRegions: [changedRegion],
      changedCivilizations: [],
      events,
    },
  };
}

export function replayEvents(
  initial: WorldState,
  events: WorldEvent[],
): WorldState {
  let state = structuredClone(initial);
  for (const event of events) {
    if (event.type === "CONTRIBUTION_ADDED") {
      const region = event.payload.regionPatch as PlanetRegion | undefined;
      if (region) {
        state.regions = state.regions.map((current) =>
          current.id === region.id ? region : current,
        );
        state.version += 1;
      }
    }
    if (event.type === "TICK_COMPLETED") {
      const patch = event.payload.statePatch as
        | {
            version: number;
            tick: number;
            year: number;
            changedRegions: PlanetRegion[];
            changedCivilizations: CivilizationState[];
            species: SpeciesState[];
          }
        | undefined;
      if (!patch) continue;
      const regions = new Map(
        patch.changedRegions.map((region) => [region.id, region]),
      );
      const civilizations = new Map(
        patch.changedCivilizations.map((civilization) => [
          civilization.id,
          civilization,
        ]),
      );
      state = {
        ...state,
        version: patch.version,
        tick: patch.tick,
        year: patch.year,
        regions: state.regions.map(
          (region) => regions.get(region.id) ?? region,
        ),
        civilizations: state.civilizations.map(
          (civilization) => civilizations.get(civilization.id) ?? civilization,
        ),
        species: patch.species,
      };
    }
  }
  return state;
}
