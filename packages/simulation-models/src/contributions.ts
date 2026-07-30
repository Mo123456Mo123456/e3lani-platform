import {
  ContributionAnalysisSchema,
  ContributionInputSchema,
  type CausalLink,
  type ContributionAnalysis,
  type ContributionInput,
  type PlantEntity,
  type ResourceEntity,
  type SimulationEvent,
  type SpeciesEntity,
  type TechnologyEntity,
  type WorldState,
} from "@kawkab/shared-types";

import {
  applyEvent,
  causeFromContribution,
  causeFromEvent,
  createCausalLink,
  createEvent,
  type EventDraft,
} from "./events.js";

export interface ContributionImpactResult {
  state: WorldState;
  analysis: ContributionAnalysis;
  events: SimulationEvent[];
  causalLinks: CausalLink[];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function hasContribution(state: WorldState, contributionId: string): boolean {
  return [
    ...state.plants,
    ...state.resources,
    ...state.species,
    ...state.civilizations,
    ...state.technologies,
  ].some((entity) => entity.contributionId === contributionId);
}

export function analyzeContribution(
  state: WorldState,
  uncheckedInput: ContributionInput,
): ContributionAnalysis {
  const input = ContributionInputSchema.parse(uncheckedInput);
  const region = state.regions.find(({ id }) => id === input.regionId);
  const warnings: ContributionAnalysis["warnings"] = [];
  let accepted = Boolean(region);

  if (!region) {
    warnings.push({
      ar: "المنطقة المحددة غير موجودة",
      en: "The selected region does not exist",
    });
  }
  if (input.submittedAtTick > state.tick) {
    accepted = false;
    warnings.push({
      ar: "لا يمكن تقديم مساهمة من خطوة مستقبلية",
      en: "A contribution cannot be submitted from a future tick",
    });
  }
  if (hasContribution(state, input.id)) {
    accepted = false;
    warnings.push({
      ar: "استُخدم معرّف هذه المساهمة من قبل",
      en: "This contribution ID has already been used",
    });
  }

  let populationDelta = 0;
  let carryingCapacityDelta = 0;
  let pollutionDelta = 0;
  let biodiversityDelta = 0;
  let directEventTypes: ContributionAnalysis["directEventTypes"] = [];
  let secondaryEventTypes: ContributionAnalysis["secondaryEventTypes"] = [];

  if (region) {
    switch (input.kind) {
      case "PLANT": {
        if (
          region.biome === "OCEAN" ||
          region.biome === "ICE" ||
          region.biome === "MOUNTAIN"
        ) {
          accepted = false;
          warnings.push({
            ar: "البيئة المحددة غير مناسبة لهذا النموذج النباتي المبسّط",
            en: "The selected biome is unsuitable in this simplified plant model",
          });
        }
        const capacityFraction = clamp(
          input.resilience * 0.05 +
            input.growthRate * 0.05 +
            input.nutrition * 0.08 -
            input.invasiveness * 0.04,
          -0.04,
          0.16,
        );
        carryingCapacityDelta = region.carryingCapacity * capacityFraction;
        populationDelta = Math.min(
          Math.max(0, carryingCapacityDelta),
          region.population * input.nutrition * 0.015,
        );
        biodiversityDelta = clamp(
          0.08 * (1 - input.invasiveness) - input.invasiveness * 0.04,
          -0.08,
          0.08,
        );
        directEventTypes = ["PLANT_CREATED"];
        secondaryEventTypes = ["POPULATION_CHANGED"];
        break;
      }
      case "RESOURCE": {
        pollutionDelta =
          input.pollutionRisk * (1 - input.renewability) * 0.08;
        directEventTypes = ["RESOURCE_DISCOVERED"];
        secondaryEventTypes =
          pollutionDelta > 0.000001 ? ["POLLUTION_CHANGED"] : [];
        break;
      }
      case "SPECIES": {
        carryingCapacityDelta =
          region.carryingCapacity *
          clamp(input.ecologicalImpact * 0.08, -0.08, 0.08);
        populationDelta = clamp(
          region.population *
            input.ecologicalImpact *
            input.adaptability *
            0.02,
          -region.population * 0.03,
          Math.max(0, region.carryingCapacity - region.population),
        );
        biodiversityDelta = clamp(
          0.05 +
            input.adaptability * 0.05 -
            Math.max(0, -input.ecologicalImpact) * 0.08,
          -0.05,
          0.1,
        );
        directEventTypes = ["SPECIES_CREATED"];
        secondaryEventTypes = ["POPULATION_CHANGED"];
        break;
      }
      case "CIVILIZATION": {
        const availableCapacity = Math.max(
          0,
          region.carryingCapacity - region.population,
        );
        populationDelta = Math.min(
          input.foundingPopulation,
          availableCapacity,
        );
        if (populationDelta <= 0) {
          accepted = false;
          warnings.push({
            ar: "لا توجد قدرة استيعابية متاحة لتأسيس الحضارة",
            en: "No carrying capacity is available to found the civilization",
          });
        } else if (populationDelta < input.foundingPopulation) {
          warnings.push({
            ar: "خُفّض عدد المؤسسين ليلائم القدرة الاستيعابية",
            en: "Founding population was capped by local carrying capacity",
          });
        }
        directEventTypes = ["CIVILIZATION_FOUNDED"];
        secondaryEventTypes = ["POPULATION_CHANGED"];
        break;
      }
      case "TECHNOLOGY": {
        if (
          input.civilizationId &&
          !state.civilizations.some(({ id }) => id === input.civilizationId)
        ) {
          accepted = false;
          warnings.push({
            ar: "الحضارة المرتبطة بالتقنية غير موجودة",
            en: "The technology's linked civilization does not exist",
          });
        }
        carryingCapacityDelta =
          region.carryingCapacity *
          Math.max(0, input.populationEffect) *
          input.effectiveness *
          0.08;
        populationDelta = clamp(
          region.population *
            input.populationEffect *
            input.effectiveness *
            0.04,
          -region.population * 0.04,
          Math.max(
            0,
            region.carryingCapacity +
              carryingCapacityDelta -
              region.population,
          ),
        );
        pollutionDelta =
          input.pollutionEffect * input.effectiveness * 0.08;
        directEventTypes = ["TECHNOLOGY_DISCOVERED"];
        secondaryEventTypes = [
          ...(populationDelta !== 0 || carryingCapacityDelta !== 0
            ? (["POPULATION_CHANGED"] as const)
            : []),
          ...(pollutionDelta !== 0
            ? (["POLLUTION_CHANGED"] as const)
            : []),
        ];
        break;
      }
    }
  }

  return ContributionAnalysisSchema.parse({
    contributionId: input.id,
    accepted,
    confidence: 0.72,
    normalizedInput: input,
    projection: {
      populationDelta: round(populationDelta),
      carryingCapacityDelta: round(carryingCapacityDelta),
      pollutionDelta: round(clamp(pollutionDelta, -1, 1)),
      biodiversityDelta: round(clamp(biodiversityDelta, -1, 1)),
    },
    directEventTypes,
    secondaryEventTypes,
    warnings,
    assumptions: [
      {
        ar: "النموذج تعليمي مبسّط وليس تنبؤاً علمياً",
        en: "The model is educationally simplified, not a scientific forecast",
      },
      {
        ar: "كل التأثيرات محدودة بالقدرة الاستيعابية والنطاقات الفيزيائية",
        en: "All effects are bounded by carrying capacity and physical ranges",
      },
    ],
  });
}

export function simulateContribution(
  previousState: WorldState,
  uncheckedInput: ContributionInput,
): ContributionImpactResult {
  const input = ContributionInputSchema.parse(uncheckedInput);
  const analysis = analyzeContribution(previousState, input);
  if (!analysis.accepted) {
    return {
      state: previousState,
      analysis,
      events: [],
      causalLinks: [],
    };
  }

  let state = previousState;
  const events: SimulationEvent[] = [];
  const causalLinks: CausalLink[] = [];

  const emit = (
    draft: EventDraft,
    sourceKind: CausalLink["sourceKind"],
    sourceId: string,
    relationship: CausalLink["relationship"],
    strength: number,
  ): SimulationEvent => {
    const event = createEvent(state, draft);
    state = applyEvent(state, event);
    events.push(event);
    causalLinks.push(
      createCausalLink(
        sourceKind,
        sourceId,
        event.id,
        relationship,
        strength,
        draft.causes[0]?.explanation ?? {
          ar: "رابط سببي",
          en: "Causal link",
        },
      ),
    );
    return event;
  };

  const contributionEvent = emit(
    {
      type: "CONTRIBUTION_ADDED",
      regionId: input.regionId,
      key: `contribution:${input.id}`,
      title: { ar: "أضيفت مساهمة", en: "Contribution added" },
      description: {
        ar: "قُبلت المساهمة وأصبحت جزءاً من سجل العالم",
        en: "The contribution was accepted into the world's event log",
      },
      causes: [causeFromContribution(input.id)],
      data: { contributionId: input.id, kind: input.kind },
      effects: {},
    },
    "CONTRIBUTION",
    input.id,
    "DIRECT",
    1,
  );

  let directEvent: SimulationEvent;
  switch (input.kind) {
    case "PLANT": {
      const plant: PlantEntity = {
        id: `plant:${input.id}`,
        contributionId: input.id,
        name: input.name,
        homeRegionId: input.regionId,
        resilience: input.resilience,
        growthRate: input.growthRate,
        nutrition: input.nutrition,
        invasiveness: input.invasiveness,
      };
      directEvent = emit(
        {
          type: "PLANT_CREATED",
          regionId: input.regionId,
          key: plant.id,
          title: { ar: "ظهر نبات جديد", en: "New plant created" },
          description: {
            ar: "أُضيف النبات بصفاته البيئية المحددة",
            en: "The plant was added with its specified ecological traits",
          },
          causes: [causeFromEvent(contributionEvent)],
          data: { plantId: plant.id },
          effects: { addPlants: [plant] },
        },
        "EVENT",
        contributionEvent.id,
        "DIRECT",
        1,
      );
      applyPopulationAndCapacityEffects(state, analysis, input.regionId, directEvent, emit);
      break;
    }
    case "RESOURCE": {
      const resource: ResourceEntity = {
        id: `resource:${input.id}`,
        contributionId: input.id,
        name: input.name,
        regionId: input.regionId,
        kind: input.resourceKind,
        abundance: input.abundance,
        renewability: input.renewability,
        strategicValue: input.strategicValue,
        pollutionRisk: input.pollutionRisk,
        depleted: input.abundance === 0,
      };
      directEvent = emit(
        {
          type: "RESOURCE_DISCOVERED",
          regionId: input.regionId,
          key: resource.id,
          title: { ar: "اكتُشف مورد", en: "Resource discovered" },
          description: {
            ar: "أضيف مورد جديد بإمكاناته ومخاطره",
            en: "A resource was added with its potential and risks",
          },
          causes: [causeFromEvent(contributionEvent)],
          data: { resourceId: resource.id },
          effects: { addResources: [resource] },
        },
        "EVENT",
        contributionEvent.id,
        "DIRECT",
        1,
      );
      applyPollutionEffect(state, analysis, input.regionId, directEvent, emit);
      break;
    }
    case "SPECIES": {
      const species: SpeciesEntity = {
        id: `species:${input.id}`,
        contributionId: input.id,
        name: input.name,
        homeRegionId: input.regionId,
        trophicLevel: input.trophicLevel,
        adaptability: input.adaptability,
        reproductionRate: input.reproductionRate,
        ecologicalImpact: input.ecologicalImpact,
      };
      directEvent = emit(
        {
          type: "SPECIES_CREATED",
          regionId: input.regionId,
          key: species.id,
          title: { ar: "ظهر نوع جديد", en: "New species created" },
          description: {
            ar: "دخل النوع الجديد النظام البيئي",
            en: "The new species entered the ecosystem",
          },
          causes: [causeFromEvent(contributionEvent)],
          data: { speciesId: species.id },
          effects: { addSpecies: [species] },
        },
        "EVENT",
        contributionEvent.id,
        "DIRECT",
        1,
      );
      applyPopulationAndCapacityEffects(state, analysis, input.regionId, directEvent, emit);
      break;
    }
    case "CIVILIZATION": {
      const civilizationId = `civilization:${input.id}`;
      const population = Math.max(0, analysis.projection.populationDelta);
      directEvent = emit(
        {
          type: "CIVILIZATION_FOUNDED",
          regionId: input.regionId,
          key: civilizationId,
          title: { ar: "تأسست حضارة", en: "Civilization founded" },
          description: {
            ar: "تأسست حضارة ضمن حدود موارد منطقتها",
            en: "A civilization was founded within its region's resource limits",
          },
          causes: [causeFromEvent(contributionEvent)],
          data: { civilizationId },
          effects: {
            addCivilizations: [
              {
                id: civilizationId,
                contributionId: input.id,
                name: input.name,
                capitalRegionId: input.regionId,
                population,
                technologyLevel: input.technologyLevel,
                stability: input.stability,
                technologyIds: [],
                alliedCivilizationIds: [],
                atWarWithCivilizationIds: [],
              },
            ],
          },
        },
        "EVENT",
        contributionEvent.id,
        "DIRECT",
        1,
      );
      applyPopulationAndCapacityEffects(state, analysis, input.regionId, directEvent, emit);
      break;
    }
    case "TECHNOLOGY": {
      const technology: TechnologyEntity = {
        id: `technology:${input.id}`,
        contributionId: input.id,
        name: input.name,
        regionId: input.regionId,
        civilizationId: input.civilizationId,
        domain: input.domain,
        effectiveness: input.effectiveness,
        pollutionEffect: input.pollutionEffect,
        populationEffect: input.populationEffect,
      };
      const civilization = input.civilizationId
        ? state.civilizations.find(({ id }) => id === input.civilizationId)
        : undefined;
      directEvent = emit(
        {
          type: "TECHNOLOGY_DISCOVERED",
          regionId: input.regionId,
          key: technology.id,
          title: { ar: "اكتُشفت تقنية", en: "Technology discovered" },
          description: {
            ar: "أضيفت تقنية وتأثيراتها المبسّطة",
            en: "A technology and its simplified effects were added",
          },
          causes: [causeFromEvent(contributionEvent)],
          data: { technologyId: technology.id },
          effects: {
            addTechnologies: [technology],
            ...(civilization
              ? {
                  civilizationChanges: [
                    {
                      civilizationId: civilization.id,
                      technologyIds: [
                        ...civilization.technologyIds,
                        technology.id,
                      ],
                      technologyLevel: round(
                        clamp(
                          civilization.technologyLevel +
                            input.effectiveness * 0.04,
                          0,
                          1,
                        ),
                      ),
                    },
                  ],
                }
              : {}),
          },
        },
        "EVENT",
        contributionEvent.id,
        "DIRECT",
        1,
      );
      applyPopulationAndCapacityEffects(state, analysis, input.regionId, directEvent, emit);
      applyPollutionEffect(state, analysis, input.regionId, directEvent, emit);
      break;
    }
  }

  return { state, analysis, events, causalLinks };
}

type EmitContributionEvent = (
  draft: EventDraft,
  sourceKind: CausalLink["sourceKind"],
  sourceId: string,
  relationship: CausalLink["relationship"],
  strength: number,
) => SimulationEvent;

function applyPopulationAndCapacityEffects(
  state: WorldState,
  analysis: ContributionAnalysis,
  regionId: string,
  directEvent: SimulationEvent,
  emit: EmitContributionEvent,
): void {
  const region = state.regions.find(({ id }) => id === regionId);
  if (!region) return;
  const carryingCapacity = round(
    Math.max(
      0,
      region.carryingCapacity + analysis.projection.carryingCapacityDelta,
    ),
  );
  const population = round(
    clamp(
      region.population + analysis.projection.populationDelta,
      0,
      carryingCapacity,
    ),
  );
  if (
    carryingCapacity === region.carryingCapacity &&
    population === region.population
  ) {
    return;
  }
  emit(
    {
      type: "POPULATION_CHANGED",
      regionId,
      key: `secondary-population:${analysis.contributionId}`,
      title: { ar: "تغيّر السكان", en: "Population changed" },
      description: {
        ar: "أثر ثانوي محدود بالقدرة الاستيعابية",
        en: "A secondary effect bounded by carrying capacity",
      },
      causes: [causeFromEvent(directEvent)],
      data: {
        populationDelta: round(population - region.population),
        carryingCapacityDelta: round(
          carryingCapacity - region.carryingCapacity,
        ),
      },
      effects: {
        regionChanges: [{ regionId, population, carryingCapacity }],
      },
    },
    "EVENT",
    directEvent.id,
    "SECONDARY",
    0.82,
  );
}

function applyPollutionEffect(
  state: WorldState,
  analysis: ContributionAnalysis,
  regionId: string,
  directEvent: SimulationEvent,
  emit: EmitContributionEvent,
): void {
  const region = state.regions.find(({ id }) => id === regionId);
  if (!region || analysis.projection.pollutionDelta === 0) return;
  const pollution = round(
    clamp(region.pollution + analysis.projection.pollutionDelta, 0, 1),
  );
  if (pollution === region.pollution) return;
  emit(
    {
      type: "POLLUTION_CHANGED",
      regionId,
      key: `secondary-pollution:${analysis.contributionId}`,
      title: { ar: "تغيّر التلوث", en: "Pollution changed" },
      description: {
        ar: "أثر بيئي ثانوي محدود بين الصفر والواحد",
        en: "A secondary environmental effect bounded to the zero-one range",
      },
      causes: [causeFromEvent(directEvent)],
      data: { pollutionDelta: round(pollution - region.pollution) },
      effects: { regionChanges: [{ regionId, pollution }] },
    },
    "EVENT",
    directEvent.id,
    "SECONDARY",
    0.8,
  );
}
