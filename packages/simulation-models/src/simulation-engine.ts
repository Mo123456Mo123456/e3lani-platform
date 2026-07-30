import type {
  Contribution,
  ContributionAnalysis,
  FutureScenario,
  Region,
  SimulationResult,
  WorldEvent,
  WorldEventKind,
  WorldState,
} from "./types";
import { calculateMetrics, clamp, hashString, round, seededUnit } from "./world-generator";

const YEARS_PER_TICK = 10;

function sphericalDistance(a: Region, b: Region) {
  const latA = (a.latitude * Math.PI) / 180;
  const latB = (b.latitude * Math.PI) / 180;
  const longitude = ((a.longitude - b.longitude) * Math.PI) / 180;
  return Math.acos(
    clamp(
      Math.sin(latA) * Math.sin(latB) + Math.cos(latA) * Math.cos(latB) * Math.cos(longitude),
      -1,
      1,
    ),
  );
}

function eventCopy(
  state: WorldState,
  kind: WorldEventKind,
  regionId: string,
  sequence: number,
  data: Pick<
    WorldEvent,
    | "titleAr"
    | "titleEn"
    | "descriptionAr"
    | "descriptionEn"
    | "importance"
    | "confidence"
    | "causeIds"
    | "contributionId"
    | "directImpact"
  >,
): WorldEvent {
  return {
    id: `event-${state.tick + 1}-${kind.toLocaleLowerCase()}-${sequence}`,
    kind,
    tick: state.tick + 1,
    year: state.year + YEARS_PER_TICK,
    regionId,
    ...data,
  };
}

function contributionEffects(contributions: Contribution[], region: Region) {
  const present = contributions.filter((item) => item.spreadRegionIds.includes(region.id));
  return present.reduce(
    (total, item) => ({
      absorption:
        total.absorption +
        item.analysis.traits.pollutionAbsorption *
          item.analysis.traits.growthRate *
          (1 - item.analysis.traits.waterNeed * Math.max(0, 0.45 - region.moisture)) *
          0.004,
      waterPressure: total.waterPressure + item.analysis.traits.waterNeed * 0.0018,
      fertility:
        total.fertility +
        (item.analysis.category === "plant" ? item.analysis.traits.adaptability * 0.0014 : 0),
      capacity:
        total.capacity +
        (item.analysis.category === "plant" || item.analysis.category === "invention"
          ? item.analysis.traits.economicValue * 0.0008
          : 0),
    }),
    { absorption: 0, waterPressure: 0, fertility: 0, capacity: 0 },
  );
}

function updateRegions(state: WorldState) {
  return state.regions.map((region) => {
    const effects = contributionEffects(state.contributions, region);
    const civilization = region.civilizationId
      ? state.civilizations.find((item) => item.id === region.civilizationId)
      : null;
    const industrialEmission =
      civilization && region.population > 0
        ? (region.population / Math.max(1, region.carryingCapacity)) *
          civilization.technology *
          0.0022
        : 0;
    const pollution = round(
      clamp(region.pollution * 0.993 + industrialEmission - effects.absorption),
    );
    const moisture = round(
      clamp(
        region.moisture -
          effects.waterPressure +
          (seededUnit(state.seed, "rain", state.tick + 1, region.id) - 0.5) * 0.003,
      ),
    );
    const temperature = round(
      clamp(region.temperature + pollution * 0.0009 + (state.metrics.temperature - 0.5) * 0.0002),
    );
    const fertility = round(clamp(region.fertility + effects.fertility - pollution * 0.0008));
    const carryingCapacity =
      region.carryingCapacity === 0
        ? 0
        : Math.max(
            1,
            Math.round(
              region.carryingCapacity *
                (1 + effects.capacity + (fertility - region.fertility) * 0.018),
            ),
          );
    const ratio = region.population / Math.max(1, carryingCapacity);
    const growthRate =
      region.population > 0
        ? 0.0085 * (1 - ratio) * (0.72 + fertility * 0.28) - pollution * 0.002
        : 0;
    const population =
      carryingCapacity === 0
        ? 0
        : Math.min(carryingCapacity, Math.max(0, Math.round(region.population * (1 + growthRate))));
    return {
      ...region,
      pollution,
      moisture,
      temperature,
      fertility,
      carryingCapacity,
      population,
    };
  });
}

function spreadContributions(state: WorldState, regions: Region[]) {
  const added: { contributionId: string; regionId: string; sourceRegionId: string }[] = [];
  const contributions = state.contributions.map((contribution) => {
    const existing = new Set(contribution.spreadRegionIds);
    const possible = regions
      .filter(
        (region) =>
          !existing.has(region.id) &&
          contribution.analysis.possibleBiomes.includes(region.biome) &&
          contribution.spreadRegionIds.some((sourceId) => {
            const source = regions.find((item) => item.id === sourceId);
            return source ? sphericalDistance(source, region) < 0.43 : false;
          }),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const chance =
      contribution.analysis.traits.growthRate *
      contribution.analysis.traits.adaptability *
      (0.4 + contribution.analysis.traits.heatResistance * 0.2);
    const candidate = possible.find(
      (region) =>
        seededUnit(state.seed, contribution.id, state.tick + 1, region.id) <
        chance / Math.max(1, possible.length * 0.72),
    );
    if (!candidate) return { ...contribution };
    const sourceRegionId =
      contribution.spreadRegionIds.find((sourceId) => {
        const source = regions.find((item) => item.id === sourceId);
        return source ? sphericalDistance(source, candidate) < 0.43 : false;
      }) ?? contribution.originRegionId;
    added.push({ contributionId: contribution.id, regionId: candidate.id, sourceRegionId });
    return {
      ...contribution,
      spreadRegionIds: [...contribution.spreadRegionIds, candidate.id],
      environmentalImpact: round(
        contribution.environmentalImpact +
          contribution.analysis.traits.pollutionAbsorption * 0.012 -
          contribution.analysis.traits.waterNeed * 0.004,
      ),
      economicImpact: round(
        contribution.economicImpact + contribution.analysis.traits.economicValue * 0.009,
      ),
    };
  });
  return { contributions, added };
}

function systemicEvents(state: WorldState, regions: Region[]) {
  const events: WorldEvent[] = [];
  if ((state.tick + 1) % 5 === 0) {
    const pressure = [...regions]
      .filter((region) => region.population > 0)
      .sort(
        (a, b) =>
          b.population / Math.max(1, b.carryingCapacity) -
          a.population / Math.max(1, a.carryingCapacity),
      )[0];
    if (pressure && pressure.population / pressure.carryingCapacity > 0.16) {
      events.push(
        eventCopy(state, "MIGRATION_STARTED", pressure.id, events.length, {
          titleAr: "موجة هجرة إقليمية",
          titleEn: "Regional migration wave",
          descriptionAr: "دفع اقتراب السكان من القدرة الاستيعابية مجموعات إلى أقاليم مجاورة.",
          descriptionEn: "Population pressure near carrying capacity drove groups toward nearby regions.",
          importance: 3,
          confidence: 0.88,
          causeIds: [pressure.id, pressure.civilizationId ?? pressure.id],
          contributionId: null,
          directImpact: { populationPressure: round(pressure.population / pressure.carryingCapacity) },
        }),
      );
    }
  }
  if ((state.tick + 1) % 7 === 0 && state.civilizations.length > 0) {
    const civilization = [...state.civilizations].sort(
      (a, b) =>
        b.technology +
        seededUnit(state.seed, "discovery", state.tick, b.id) * 0.08 -
        (a.technology + seededUnit(state.seed, "discovery", state.tick, a.id) * 0.08),
    )[0];
    events.push(
      eventCopy(state, "TECHNOLOGY_DISCOVERED", civilization.capitalRegionId, events.length, {
        titleAr: `قفزة تقنية في ${civilization.nameAr}`,
        titleEn: `Technology leap in ${civilization.nameEn}`,
        descriptionAr: "أتاح تراكم المعرفة والاقتصاد المستقر تطوير تقنية أكثر كفاءة.",
        descriptionEn: "Accumulated knowledge and a stable economy enabled a more efficient technology.",
        importance: 3,
        confidence: 0.9,
        causeIds: [civilization.id, civilization.capitalRegionId],
        contributionId: null,
        directImpact: { technology: civilization.technology },
      }),
    );
  }
  if ((state.tick + 1) % 11 === 0) {
    const volcanic = regions.find(
      (region) =>
        region.biome === "volcanic" &&
        seededUnit(state.seed, "volcano", state.tick + 1, region.id) > 0.45,
    );
    if (volcanic) {
      events.push(
        eventCopy(state, "VOLCANO_ERUPTED", volcanic.id, events.length, {
          titleAr: "ثوران بركاني واسع",
          titleEn: "Major volcanic eruption",
          descriptionAr: "رفع الضغط الجيولوجي عند حدود الصفائح احتمال الثوران.",
          descriptionEn: "Geological pressure near a plate boundary raised eruption risk.",
          importance: 4,
          confidence: 0.86,
          causeIds: [volcanic.id, "plate-pressure"],
          contributionId: null,
          directImpact: { temperature: 0.012, pollution: 0.08 },
        }),
      );
    }
  }
  return events;
}

export function stepWorld(state: WorldState): SimulationResult {
  const regions = updateRegions(state);
  const spread = spreadContributions(state, regions);
  const spreadEvents = spread.added.map((entry, index) => {
    const contribution = spread.contributions.find((item) => item.id === entry.contributionId)!;
    return eventCopy(state, "CONTRIBUTION_SPREAD", entry.regionId, index, {
      titleAr: `انتشار ${contribution.analysis.name}`,
      titleEn: `${contribution.analysis.name} spreads`,
      descriptionAr: "سمحت ملاءمة المناخ والاتصال بإقليم المنشأ بانتقال العنصر إلى موطن جديد.",
      descriptionEn: "Climate suitability and connection to the origin allowed expansion into a new habitat.",
      importance: 3,
      confidence: round(contribution.analysis.confidence * 0.94),
      causeIds: [entry.contributionId, entry.sourceRegionId, entry.regionId],
      contributionId: entry.contributionId,
      directImpact: {
        pollution: round(-contribution.analysis.traits.pollutionAbsorption * 0.01),
        water: round(-contribution.analysis.traits.waterNeed * 0.006),
      },
    });
  });
  const otherEvents = systemicEvents(state, regions);
  const generatedEvents = [...spreadEvents, ...otherEvents];
  const civilizations = state.civilizations.map((civilization) => {
    const population = regions
      .filter((region) => region.civilizationId === civilization.id)
      .reduce((sum, region) => sum + region.population, 0);
    return {
      ...civilization,
      population,
      technology: round(
        clamp(
          civilization.technology +
            civilization.economy * 0.0008 +
            seededUnit(state.seed, "tech-growth", state.tick, civilization.id) * 0.0003,
        ),
      ),
      pollution: round(clamp(civilization.pollution * 0.998)),
    };
  });
  const metrics = calculateMetrics(regions, civilizations);
  const causalLinks = [
    ...state.causalLinks,
    ...generatedEvents.flatMap((event) =>
      event.causeIds.map((causeId, index) => ({
        id: `causal-${event.id}-${index}`,
        fromId: causeId,
        toId: event.id,
        relation: index === 0 ? "primary_cause" : "contributing_factor",
        strength: round(event.confidence * (index === 0 ? 1 : 0.72)),
      })),
    ),
  ].slice(-1_000);
  const nextState: WorldState = {
    ...state,
    tick: state.tick + 1,
    year: state.year + YEARS_PER_TICK,
    regions,
    civilizations,
    contributions: spread.contributions,
    events: [...generatedEvents, ...state.events].slice(0, 500),
    causalLinks,
    metrics,
  };
  return {
    state: nextState,
    delta: {
      tick: nextState.tick,
      year: nextState.year,
      changedRegionIds: regions
        .filter((region, index) => {
          const before = state.regions[index];
          return (
            region.population !== before.population ||
            region.pollution !== before.pollution ||
            region.moisture !== before.moisture
          );
        })
        .map((region) => region.id),
      events: generatedEvents,
      metrics,
    },
  };
}

export function runTicks(state: WorldState, count: number) {
  let current = state;
  const deltas: SimulationResult["delta"][] = [];
  for (let index = 0; index < Math.max(0, Math.min(1_000, Math.floor(count))); index += 1) {
    const result = stepWorld(current);
    current = result.state;
    deltas.push(result.delta);
  }
  return { state: current, deltas };
}

export function introduceContribution(
  state: WorldState,
  input: {
    ownerId: string;
    sourceText: string;
    originRegionId: string;
    analysis: ContributionAnalysis;
  },
): WorldState {
  const origin = state.regions.find((region) => region.id === input.originRegionId);
  if (!origin) throw new Error("REGION_NOT_FOUND");
  const id = `contribution-${state.tick}-${state.contributions.length + 1}-${hashString(input.sourceText).toString(36)}`;
  const suitable = input.analysis.possibleBiomes.includes(origin.biome);
  const contribution: Contribution = {
    id,
    ownerId: input.ownerId,
    createdAtTick: state.tick,
    originRegionId: origin.id,
    sourceText: input.sourceText.trim(),
    analysis: input.analysis,
    spreadRegionIds: [origin.id],
    environmentalImpact: round(
      input.analysis.traits.pollutionAbsorption * 0.02 - input.analysis.traits.waterNeed * 0.008,
    ),
    economicImpact: round(input.analysis.traits.economicValue * 0.014),
  };
  const event: WorldEvent = {
    id: `event-contribution-${id}`,
    kind: "CONTRIBUTION_INTRODUCED",
    tick: state.tick,
    year: state.year,
    regionId: origin.id,
    titleAr: `إدخال ${input.analysis.name} إلى العالم`,
    titleEn: `${input.analysis.name} introduced`,
    descriptionAr: suitable
      ? "قُبل العنصر بعد التحقق من بنيته وتوازنه، وبدأ من بيئة ملائمة."
      : "قُبل العنصر بفرصة تكيف منخفضة لأن بيئة البداية ليست ضمن موائله المثلى.",
    descriptionEn: suitable
      ? "The element passed validation and balance checks, then entered a suitable habitat."
      : "The element entered with reduced adaptation odds because the origin is not an ideal habitat.",
    importance: 5,
    confidence: suitable ? input.analysis.confidence : round(input.analysis.confidence * 0.62),
    causeIds: [id, origin.id],
    contributionId: id,
    directImpact: {
      pollution: round(-input.analysis.traits.pollutionAbsorption * 0.01),
      water: round(-input.analysis.traits.waterNeed * 0.006),
      economy: round(input.analysis.traits.economicValue * 0.01),
    },
  };
  return {
    ...state,
    contributions: [...state.contributions, contribution],
    events: [event, ...state.events],
    causalLinks: [
      ...state.causalLinks,
      {
        id: `causal-${id}-origin`,
        fromId: origin.id,
        toId: event.id,
        relation: "origin_environment",
        strength: suitable ? 0.92 : 0.48,
      },
      {
        id: `causal-${id}-contribution`,
        fromId: id,
        toId: event.id,
        relation: "introduced_element",
        strength: 1,
      },
    ],
  };
}

export function projectContributionScenarios(
  state: WorldState,
  analysis: ContributionAnalysis,
  horizonYears: number,
  runs = 64,
): FutureScenario[] {
  const safeRuns = Math.max(8, Math.min(500, Math.floor(runs)));
  const horizon = Math.max(1, Math.min(10_000, Math.floor(horizonYears)));
  const samples = Array.from({ length: safeRuns }, (_, index) => {
    const climate = seededUnit(state.seed, "scenario-climate", horizon, index);
    const adoption = seededUnit(state.seed, "scenario-adoption", horizon, index);
    const competition = seededUnit(state.seed, "scenario-competition", horizon, index);
    const timeScale = Math.log10(horizon + 10);
    const environmentalImpact =
      (analysis.traits.pollutionAbsorption * climate -
        analysis.traits.waterNeed * (1 - climate) * 0.55 -
        analysis.traits.aggression * competition * 0.28) *
      timeScale;
    const economicImpact =
      (analysis.traits.economicValue * adoption - competition * 0.16) * timeScale;
    const spreadRegions = Math.max(
      1,
      Math.round(
        (analysis.traits.growthRate * 0.65 + analysis.traits.adaptability * 0.35) *
          adoption *
          Math.sqrt(horizon) *
          1.8,
      ),
    );
    return { environmentalImpact, economicImpact, spreadRegions, climate, adoption, competition };
  }).sort((a, b) => a.environmentalImpact + a.economicImpact - (b.environmentalImpact + b.economicImpact));
  const expected = samples[Math.floor(samples.length / 2)];
  const best = samples[samples.length - 1];
  const worst = samples[0];
  const uncertainty = round(
    clamp(
      (best.environmentalImpact +
        best.economicImpact -
        worst.environmentalImpact -
        worst.economicImpact) /
        8,
    ),
  );
  const toScenario = (
    sample: (typeof samples)[number],
    label: FutureScenario["label"],
    probability: number,
  ): FutureScenario => ({
    horizonYears: horizon,
    label,
    probability,
    uncertainty,
    environmentalImpact: round(sample.environmentalImpact),
    economicImpact: round(sample.economicImpact),
    spreadRegions: Math.min(state.regions.length, sample.spreadRegions),
    factors: [
      sample.climate > 0.55 ? "مناخ ملائم" : "ضغط مناخي",
      sample.adoption > 0.55 ? "تبنٍ حضاري مرتفع" : "تبنٍ حضاري محدود",
      sample.competition > 0.58 ? "منافسة بيئية مرتفعة" : "منافسة بيئية منخفضة",
    ],
  });
  return [
    toScenario(expected, "most_likely", 0.5),
    toScenario(best, "best_case", round(1 / safeRuns)),
    toScenario(worst, "worst_case", round(1 / safeRuns)),
  ];
}
