import type {
  AnalyzedContribution,
  CausalLink,
  ScenarioOutcome,
  SpeciesState,
  WorldEvent,
  WorldState,
} from "@living-planet/shared-types";
import { createSeededRandom, deterministicId } from "./random.js";

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function eventId(state: WorldState, sequence: number): string {
  return deterministicId(state.seed, `event:${state.tick + 1}`, sequence);
}

interface EventDraft extends Omit<WorldEvent, "id" | "sequence" | "createdAt"> {}

function materializeEvent(state: WorldState, offset: number, draft: EventDraft): WorldEvent {
  const sequence = state.lastEventSequence + offset + 1;
  return {
    ...draft,
    id: eventId(state, sequence),
    sequence,
    createdAt: new Date(Date.UTC(2000, 0, 1) + sequence * 1_000).toISOString(),
  };
}

function cloneState(state: WorldState): WorldState {
  return structuredClone(state);
}

export function applyEvent(source: WorldState, event: WorldEvent): WorldState {
  const state = cloneState(source);
  const region = event.regionId
    ? state.regions.find((candidate) => candidate.id === event.regionId)
    : undefined;
  const civilizationId =
    typeof event.metadata.civilizationId === "string" ? event.metadata.civilizationId : undefined;
  const civilization = civilizationId
    ? state.civilizations.find((candidate) => candidate.id === civilizationId)
    : undefined;

  if (region) {
    region.population = Math.max(
      0,
      Math.min(
        region.carryingCapacity,
        region.population + (event.directImpact.regionPopulation ?? 0),
      ),
    );
    region.pollution = clamp(region.pollution + (event.directImpact.regionPollution ?? 0));
    region.moisture = clamp(region.moisture + (event.directImpact.regionMoisture ?? 0));
    region.temperature += event.directImpact.regionTemperature ?? 0;
    region.fertility = clamp(region.fertility + (event.directImpact.regionFertility ?? 0));
  }

  if (civilization) {
    civilization.population = Math.max(
      0,
      civilization.population + (event.directImpact.civilizationPopulation ?? 0),
    );
    civilization.economy = clamp(
      civilization.economy + (event.directImpact.civilizationEconomy ?? 0),
    );
    civilization.stability = clamp(
      civilization.stability + (event.directImpact.civilizationStability ?? 0),
    );
    civilization.health = clamp(
      civilization.health + (event.directImpact.civilizationHealth ?? 0),
    );
    civilization.food = clamp(civilization.food + (event.directImpact.civilizationFood ?? 0));
    civilization.pollution = clamp(
      civilization.pollution + (event.directImpact.civilizationPollution ?? 0),
    );
  }

  state.climate.meanTemperature += event.directImpact.meanTemperature ?? 0;
  state.climate.seaLevel += event.directImpact.seaLevel ?? 0;
  state.climate.emissions = Math.max(
    0,
    state.climate.emissions + (event.directImpact.emissions ?? 0),
  );
  state.climate.vegetation = clamp(
    state.climate.vegetation + (event.directImpact.vegetation ?? 0),
  );

  if (event.type === "SPECIES_CREATED" && event.metadata.species) {
    state.species.push(event.metadata.species as SpeciesState);
  }
  if (event.type === "SPECIES_EXTINCT") {
    const speciesId =
      typeof event.metadata.speciesId === "string" ? event.metadata.speciesId : undefined;
    state.species = state.species.filter((species) => species.id !== speciesId);
  }
  if (event.type === "ALLIANCE_CREATED") {
    const participants = Array.isArray(event.metadata.participants)
      ? event.metadata.participants.filter((id): id is string => typeof id === "string")
      : [];
    for (const participant of participants) {
      const civ = state.civilizations.find((candidate) => candidate.id === participant);
      if (civ) civ.allies = Array.from(new Set([...civ.allies, ...participants])).filter(
        (id) => id !== civ.id,
      );
    }
  }
  if (event.type === "SIMULATION_TICK_COMPLETED") {
    state.tick = event.tick;
    state.year = event.simulationYear;
  }

  state.lastEventSequence = event.sequence;
  state.version += 1;
  return state;
}

export function replayEvents(initialState: WorldState, events: readonly WorldEvent[]): WorldState {
  return events.reduce(applyEvent, initialState);
}

export interface TickResult {
  state: WorldState;
  events: WorldEvent[];
  causalLinks: CausalLink[];
  changedRegionIds: string[];
}

export function simulateTick(source: WorldState, priorEvents: readonly WorldEvent[] = []): TickResult {
  if (source.paused) {
    return { state: cloneState(source), events: [], causalLinks: [], changedRegionIds: [] };
  }

  const state = cloneState(source);
  const random = createSeededRandom(`${state.seed}:tick:${state.tick + 1}`);
  const drafts: EventDraft[] = [];
  const previousCause = priorEvents.at(-1)?.id;
  const climatePressure =
    state.climate.emissions * 0.0035 - state.climate.vegetation * 0.0012;
  const volcanicRegion = state.regions
    .filter((region) => region.biome === "volcanic")
    .sort((left, right) => right.elevation - left.elevation)[0];
  const eruptionProbability = volcanicRegion
    ? clamp((volcanicRegion.elevation - 0.65) * 0.035)
    : 0;

  if (volcanicRegion && random.chance(eruptionProbability)) {
    drafts.push({
      type: "VOLCANO_ERUPTED",
      titleAr: "ثوران بركاني",
      titleEn: "Volcanic eruption",
      descriptionAr: `ارتفع الضغط الجيولوجي تحت ${volcanicRegion.nameAr} حتى تجاوز حد الاستقرار.`,
      descriptionEn: `Geological pressure beneath ${volcanicRegion.nameEn} exceeded its stability threshold.`,
      simulationYear: state.year + state.tickYears,
      tick: state.tick + 1,
      regionId: volcanicRegion.id,
      causeEventIds: previousCause ? [previousCause] : [],
      entityIds: [volcanicRegion.id],
      confidence: 0.86,
      importance: 0.82,
      directImpact: {
        regionTemperature: 0.06,
        regionPollution: 0.12,
        meanTemperature: -0.006,
        emissions: 0.03,
      },
      metadata: {
        cause: "tectonic_pressure",
        eruptionProbability,
        elevation: volcanicRegion.elevation,
      },
    });
  }

  drafts.push({
    type: "CLIMATE_CHANGED",
    titleAr: climatePressure > 0 ? "ارتفاع طفيف في الحرارة" : "استقرار مناخي",
    titleEn: climatePressure > 0 ? "Slight warming" : "Climate stabilization",
    descriptionAr:
      climatePressure > 0
        ? "فاق أثر الانبعاثات قدرة الغطاء النباتي على امتصاص الحرارة."
        : "وازن الغطاء النباتي معظم الانبعاثات في هذه الدورة.",
    descriptionEn:
      climatePressure > 0
        ? "Emissions exceeded the vegetation layer's heat absorption."
        : "Vegetation offset most emissions during this cycle.",
    simulationYear: state.year + state.tickYears,
    tick: state.tick + 1,
    causeEventIds: previousCause ? [previousCause] : [],
    entityIds: [],
    confidence: 0.94,
    importance: clamp(Math.abs(climatePressure) * 80, 0.12, 0.7),
    directImpact: {
      meanTemperature: climatePressure,
      seaLevel: Math.max(0, climatePressure) * 0.08,
    },
    metadata: {
      cause: "emissions_minus_vegetation_absorption",
      emissions: state.climate.emissions,
      vegetation: state.climate.vegetation,
    },
  });

  for (const civilization of state.civilizations) {
    const ownedRegions = state.regions.filter((region) =>
      civilization.regionIds.includes(region.id),
    );
    const capacity = ownedRegions.reduce((sum, region) => sum + region.carryingCapacity, 0);
    const pressure = capacity > 0 ? civilization.population / capacity : 1;
    const growth =
      civilization.health *
      civilization.food *
      civilization.stability *
      (1 - clamp(pressure)) *
      0.018;
    const populationDelta = Math.round(civilization.population * growth * state.tickYears);
    const capital = ownedRegions[0];
    if (capital && populationDelta !== 0) {
      drafts.push({
        type: "POPULATION_CHANGED",
        titleAr: `تغير سكان ${civilization.nameAr}`,
        titleEn: `${civilization.nameEn} population changed`,
        descriptionAr: `حدد توفر الغذاء والصحة والسعة البيئية نمو السكان بمقدار ${populationDelta.toLocaleString("ar")}.`,
        descriptionEn: `Food, health, and carrying capacity produced a population change of ${populationDelta.toLocaleString("en")}.`,
        simulationYear: state.year + state.tickYears,
        tick: state.tick + 1,
        regionId: capital.id,
        causeEventIds: previousCause ? [previousCause] : [],
        entityIds: [civilization.id, capital.id],
        confidence: 0.91,
        importance: clamp(populationDelta / 200_000, 0.08, 0.55),
        directImpact: {
          civilizationPopulation: populationDelta,
          regionPopulation: Math.round(populationDelta / Math.max(1, ownedRegions.length)),
          emissions: civilization.technology * populationDelta * 0.000000002,
        },
        metadata: {
          cause: "food_health_capacity_growth",
          civilizationId: civilization.id,
          carryingCapacity: capacity,
          populationPressure: pressure,
        },
      });
    }
  }

  const civilizationPairs = state.civilizations.flatMap((left, leftIndex) =>
    state.civilizations.slice(leftIndex + 1).map((right) => [left, right] as const),
  );
  for (const [left, right] of civilizationPairs) {
    if (left.allies.includes(right.id)) continue;
    const resourceStress = (1 - left.resources + (1 - right.resources)) / 2;
    const aggression = (left.aggression + right.aggression) / 2;
    const instability = (2 - left.stability - right.stability) / 2;
    const rivalry = left.rivals.includes(right.id) || right.rivals.includes(left.id) ? 0.28 : 0;
    const warScore = resourceStress * 0.34 + aggression * 0.28 + instability * 0.2 + rivalry;
    if (warScore > 0.72 && random.chance((warScore - 0.72) * 0.08)) {
      const regionId = left.regionIds.find((id) => right.regionIds.includes(id)) ?? left.regionIds[0];
      drafts.push({
        type: "WAR_STARTED",
        titleAr: `نزاع بين ${left.nameAr} و${right.nameAr}`,
        titleEn: `Conflict between ${left.nameEn} and ${right.nameEn}`,
        descriptionAr: "تراكم ضغط الموارد والعداء وعدم الاستقرار حتى تجاوز عتبة الحرب.",
        descriptionEn:
          "Resource pressure, hostility, and instability accumulated beyond the war threshold.",
        simulationYear: state.year + state.tickYears,
        tick: state.tick + 1,
        regionId,
        causeEventIds: previousCause ? [previousCause] : [],
        entityIds: [left.id, right.id],
        confidence: clamp(warScore),
        importance: 0.94,
        directImpact: {
          civilizationStability: -0.06,
          civilizationEconomy: -0.04,
          regionPollution: 0.02,
        },
        metadata: {
          cause: "resource_pressure_and_hostility",
          civilizationId: left.id,
          opponentId: right.id,
          warScore,
          resourceStress,
          aggression,
          instability,
        },
      });
      break;
    }
  }

  drafts.push({
    type: "SIMULATION_TICK_COMPLETED",
    titleAr: "اكتملت دورة المحاكاة",
    titleEn: "Simulation tick completed",
    descriptionAr: "حُفظت جميع تغيرات هذه الدورة كأحداث قابلة لإعادة التشغيل.",
    descriptionEn: "All changes in this cycle were persisted as replayable events.",
    simulationYear: state.year + state.tickYears,
    tick: state.tick + 1,
    causeEventIds: previousCause ? [previousCause] : [],
    entityIds: [state.planetId],
    confidence: 1,
    importance: 0.05,
    directImpact: {},
    metadata: {
      cause: "deterministic_tick_schedule",
      previousTick: state.tick,
      tickYears: state.tickYears,
    },
  });

  let nextState = state;
  const events = drafts.map((draft, index) => materializeEvent(state, index, draft));
  for (const event of events) nextState = applyEvent(nextState, event);
  const causalLinks = events.flatMap((event) =>
    event.causeEventIds.map((causeId, index) => ({
      id: deterministicId(state.seed, `causal:${event.id}`, index),
      fromEventId: causeId,
      toEventId: event.id,
      relation: String(event.metadata.cause ?? "caused"),
      strength: event.confidence,
    })),
  );

  return {
    state: nextState,
    events,
    causalLinks,
    changedRegionIds: Array.from(
      new Set(events.flatMap((event) => (event.regionId ? [event.regionId] : []))),
    ),
  };
}

export interface ContributionResult extends TickResult {
  contributionId: string;
}

export function introduceContribution(
  source: WorldState,
  analysis: AnalyzedContribution,
  regionId: string,
  ownerUserId: string,
): ContributionResult {
  const region = source.regions.find((candidate) => candidate.id === regionId);
  if (!region) throw new Error("Region does not exist");
  if (!analysis.possibleBiomes.includes(region.biome)) {
    throw new Error(`Contribution cannot survive in biome ${region.biome}`);
  }
  const contributionId = deterministicId(
    source.seed,
    `contribution:${ownerUserId}`,
    source.lastEventSequence + 1,
  );
  const rootDraft: EventDraft = {
    type: "CONTRIBUTION_ADDED",
    titleAr: `إضافة ${analysis.name}`,
    titleEn: `${analysis.name} introduced`,
    descriptionAr: `أُدخل العنصر إلى ${region.nameAr} بعد اجتياز فحص التوازن والملاءمة الحيوية.`,
    descriptionEn: `The element entered ${region.nameEn} after balance and habitat validation.`,
    simulationYear: source.year,
    tick: source.tick,
    regionId,
    causeEventIds: [],
    entityIds: [contributionId, regionId],
    contributionId,
    ownerUserId,
    confidence: analysis.balanceScore,
    importance: 0.75,
    directImpact: {
      regionPollution: -analysis.traits.pollutionAbsorption * 0.025,
      regionMoisture: -analysis.traits.waterNeed * 0.012,
      regionFertility: analysis.traits.growthRate * 0.008,
      vegetation: analysis.category === "plant" ? analysis.traits.growthRate * 0.006 : 0,
    },
    metadata: {
      cause: "validated_user_contribution",
      analysis,
      balanceScore: analysis.balanceScore,
    },
  };
  const rootEvent = materializeEvent(source, 0, rootDraft);
  const events = [rootEvent];
  let nextState = applyEvent(source, rootEvent);

  if (analysis.category === "plant" || analysis.category === "creature") {
    const species: SpeciesState = {
      id: deterministicId(source.seed, `contribution-species:${contributionId}`, 0),
      nameAr: analysis.name,
      nameEn: analysis.name,
      kind: analysis.category,
      regionIds: [regionId],
      population: Math.max(12, Math.round(800 * analysis.traits.reproductionRate)),
      carryingCapacity: Math.round(
        region.carryingCapacity *
          Math.max(0.02, analysis.traits.growthRate * (1 - analysis.traits.waterNeed * 0.35)),
      ),
      traits: analysis.traits,
      contributionId,
    };
    const speciesEvent = materializeEvent(source, 1, {
      type: "SPECIES_CREATED",
      titleAr: `ظهور ${analysis.name}`,
      titleEn: `${analysis.name} emerged`,
      descriptionAr: "تأسست جماعة أولية ضمن حدود السعة البيئية للمنطقة.",
      descriptionEn: "A founding population formed within the region's carrying capacity.",
      simulationYear: source.year,
      tick: source.tick,
      regionId,
      causeEventIds: [rootEvent.id],
      entityIds: [species.id, regionId],
      contributionId,
      ownerUserId,
      confidence: 0.96,
      importance: 0.8,
      directImpact: {},
      metadata: {
        cause: "successful_habitat_introduction",
        species,
      },
    });
    events.push(speciesEvent);
    nextState = applyEvent(nextState, speciesEvent);
  }

  return {
    contributionId,
    state: nextState,
    events,
    causalLinks: events.slice(1).map((event, index) => ({
      id: deterministicId(source.seed, `causal:${event.id}`, index),
      fromEventId: rootEvent.id,
      toEventId: event.id,
      relation: "introduced",
      strength: event.confidence,
    })),
    changedRegionIds: [regionId],
  };
}

interface ScenarioSample {
  temperatureDelta: number;
  populationDelta: number;
  pollutionDelta: number;
  biodiversityDelta: number;
}

function quantile(values: number[], position: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.floor(position * ordered.length)))]!;
}

export function projectContributionScenarios(
  state: WorldState,
  analysis: AnalyzedContribution,
  regionId: string,
  runs = 64,
): ScenarioOutcome[] {
  const region = state.regions.find((candidate) => candidate.id === regionId);
  if (!region) throw new Error("Region does not exist");
  const horizons = [1, 10, 100, 1000] as const;

  return horizons.flatMap((horizon) => {
    const samples: ScenarioSample[] = Array.from({ length: runs }, (_, run) => {
      const random = createSeededRandom(
        `${state.seed}:scenario:${state.version}:${regionId}:${horizon}:${run}`,
      );
      const suitability =
        (region.moisture * (1 - analysis.traits.waterNeed * 0.5) +
          region.fertility +
          (1 - Math.abs(region.temperature - 0.58))) /
        3;
      const uncertaintyScale = Math.log10(horizon + 1) * random.between(0.7, 1.3);
      const adoption = clamp(
        suitability * analysis.balanceScore * random.between(0.72, 1.22),
      );
      return {
        temperatureDelta:
          (analysis.traits.energyYield * 0.004 -
            analysis.traits.pollutionAbsorption * 0.013) *
          adoption *
          uncertaintyScale,
        populationDelta: Math.round(
          region.population *
            (analysis.traits.growthRate * 0.08 - analysis.traits.waterNeed * 0.025) *
            adoption *
            Math.sqrt(horizon),
        ),
        pollutionDelta:
          (analysis.traits.energyYield * 0.06 -
            analysis.traits.pollutionAbsorption * 0.18) *
          adoption *
          uncertaintyScale,
        biodiversityDelta:
          (analysis.traits.growthRate * 0.09 -
            analysis.traits.aggression * 0.08 -
            analysis.traits.waterNeed * 0.025) *
          adoption *
          uncertaintyScale,
      };
    });
    const fields = {
      temperatureDelta: samples.map((sample) => sample.temperatureDelta),
      populationDelta: samples.map((sample) => sample.populationDelta),
      pollutionDelta: samples.map((sample) => sample.pollutionDelta),
      biodiversityDelta: samples.map((sample) => sample.biodiversityDelta),
    };
    const build = (
      scenario: ScenarioOutcome["scenario"],
      percentile: number,
      probability: number,
    ): ScenarioOutcome => ({
      horizonYears: horizon,
      scenario,
      probability,
      uncertainty: clamp(Math.log10(horizon + 1) / 3.4),
      temperatureDelta: quantile(fields.temperatureDelta, percentile),
      populationDelta: quantile(fields.populationDelta, percentile),
      pollutionDelta: quantile(fields.pollutionDelta, 1 - percentile),
      biodiversityDelta: quantile(fields.biodiversityDelta, percentile),
      drivingFactors: [
        `habitat_suitability:${((region.fertility + region.moisture) / 2).toFixed(2)}`,
        `balance:${analysis.balanceScore.toFixed(2)}`,
        `water_need:${analysis.traits.waterNeed.toFixed(2)}`,
        `pollution_absorption:${analysis.traits.pollutionAbsorption.toFixed(2)}`,
      ],
    });
    return [
      build("most_likely", 0.5, 0.5),
      build("best", 0.9, 0.25),
      build("worst", 0.1, 0.25),
    ];
  });
}

export function stateChecksum(state: WorldState): string {
  const canonical = JSON.stringify(state);
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
