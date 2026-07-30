
import type { Civilization, City, Plant, Planet, PlanetRegion, Resource, SimulationState, Species, Technology, TimelineSnapshot, UserContribution, WorldEvent } from "@kawkab/shared-types";
import { SimulationStateSchema, WorldEventSchema } from "@kawkab/shared-types";
import { checksum, clamp01, dijkstra, SeededRandom, scoreWarProbability, updatePopulation } from "@kawkab/simulation-models";
import { generatePlanet } from "@kawkab/world-generator";

export interface EngineOptions {
  seed: string;
  resolution?: number;
  yearLength?: number;
}

export interface ApplyContributionResult {
  state: SimulationState;
  events: WorldEvent[];
}

export interface SnapshotComparison {
  beforeTick: number;
  afterTick: number;
  populationDelta: number;
  civilizationDelta: number;
  cityDelta: number;
  speciesDelta: number;
  plantDelta: number;
  eventDelta: number;
  averagePollutionDelta: number;
  newEventTypes: Record<string, number>;
}

export interface FutureScenario {
  run: number;
  score: number;
  finalTick: number;
  population: number;
  civilizations: number;
  wars: number;
  events: number;
  summary: string;
}

export interface FutureScenarios {
  years: number;
  runs: number;
  mostLikely: FutureScenario;
  best: FutureScenario;
  worst: FutureScenario;
  uncertainty: number;
  scenarios: FutureScenario[];
}

function now(): string {
  return new Date(0).toISOString();
}

function eventId(type: string, tick: number, serial: string | number, seed: string): string {
  return `event-${tick}-${checksum({ type, tick, serial, seed })}`;
}

function serialFactory(state: SimulationState): () => number {
  let value = state.events.filter((event) => event.tick === state.tick).length + 1;
  return () => value++;
}

function lastCause(state: SimulationState): string {
  return state.events.at(-1)?.id ?? `seed:${state.planet.seed}`;
}

function makeEvent(state: SimulationState, type: WorldEvent["type"], serial: string | number, fields: Omit<WorldEvent, "id" | "planetId" | "tick" | "type" | "createdAt" | "actorIds" | "causeEventIds"> & { actorIds?: string[]; causeEventIds?: string[] }): WorldEvent {
  return WorldEventSchema.parse({
    id: eventId(type, state.tick, serial, state.planet.seed),
    planetId: state.planet.id,
    tick: state.tick,
    type,
    actorIds: fields.actorIds ?? [],
    causeEventIds: fields.causeEventIds ?? [lastCause(state)],
    title: fields.title,
    description: fields.description,
    regionId: fields.regionId,
    data: fields.data ?? {},
    createdAt: now()
  });
}

export function appendEvent(state: SimulationState, event: WorldEvent): WorldEvent {
  const parsed = WorldEventSchema.parse(event);
  state.events.push(parsed);
  for (const causeId of parsed.causeEventIds) {
    state.causalLinks.push({ id: `${causeId}->${parsed.id}`, fromEventId: causeId, toEventId: parsed.id, reason: parsed.description, weight: 1 });
  }
  return parsed;
}

function regionKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function regionIndex(regions: PlanetRegion[]): Map<string, PlanetRegion> {
  return new Map(regions.map((region) => [regionKey(region.x, region.y), region]));
}

function neighbors(state: SimulationState, regionId: string): PlanetRegion[] {
  const region = state.planet.regions.find((candidate) => candidate.id === regionId);
  if (!region) return [];
  const byKey = regionIndex(state.planet.regions);
  return [
    byKey.get(regionKey(region.x + 1, region.y)),
    byKey.get(regionKey(region.x - 1, region.y)),
    byKey.get(regionKey(region.x, region.y + 1)),
    byKey.get(regionKey(region.x, region.y - 1))
  ].filter((candidate): candidate is PlanetRegion => candidate !== undefined && candidate.biome !== "deep_ocean");
}

function populationInRegion(state: SimulationState, regionId: string): number {
  const speciesPop = Object.values(state.species).filter((species) => species.regionId === regionId).reduce((sum, species) => sum + species.population, 0);
  const cityPop = Object.values(state.cities).filter((city) => city.regionId === regionId).reduce((sum, city) => sum + city.population, 0);
  return speciesPop + cityPop;
}

function resourceScore(state: SimulationState, regionId: string): number {
  return Object.values(state.resources)
    .filter((resource) => resource.regionId === regionId)
    .reduce((sum, resource) => sum + resource.abundance + resource.renewability * 0.5, 0);
}

function totalPopulation(state: SimulationState): number {
  return Object.values(state.species).reduce((sum, species) => sum + species.population, 0) + Object.values(state.cities).reduce((sum, city) => sum + city.population, 0);
}

function averagePollution(state: SimulationState): number {
  if (state.planet.regions.length === 0) return 0;
  return state.planet.regions.reduce((sum, region) => sum + (region.pollution ?? 0), 0) / state.planet.regions.length;
}

export function createInitialState(options: EngineOptions): SimulationState {
  const resolution = options.resolution ?? 16;
  const grid = generatePlanet(options.seed, resolution);
  const planet: Planet = {
    id: `planet-${options.seed}`,
    name: "كوكب يولد أمامك",
    seed: options.seed,
    ageYears: 0,
    radiusKm: 6371,
    regions: grid.regions,
    createdAt: now()
  };
  const resources: Record<string, Resource> = {};
  for (const region of planet.regions) {
    for (const resource of region.resources) resources[resource.id] = resource;
  }
  const bestRegions = [...planet.regions]
    .filter((region) => region.populationCapacity > 140 && region.resources.some((resource) => resource.category === "food" || resource.category === "water"))
    .sort((a, b) => b.populationCapacity + resourceScore({ planet, tick: 0, species: {}, plants: {}, resources, civilizations: {}, cities: {}, technologies: {}, events: [], causalLinks: [] }, b.id) - (a.populationCapacity + resourceScore({ planet, tick: 0, species: {}, plants: {}, resources, civilizations: {}, cities: {}, technologies: {}, events: [], causalLinks: [] }, a.id)))
    .slice(0, 8);
  const species: Record<string, Species> = {};
  bestRegions.forEach((region, index) => {
    const capacity = Math.max(160, Math.round(region.populationCapacity * 0.9));
    species[`species-${index + 1}`] = {
      id: `species-${index + 1}`,
      planetId: planet.id,
      regionId: region.id,
      name: index === 0 ? "رعاة الفجر" : `Species ${index + 1}`,
      population: Math.min(capacity, 110 + index * 45),
      carryingCapacity: capacity,
      preySpeciesIds: [],
      predatorSpeciesIds: [],
      traits: [{ name: "resilience", value: 0.42 + index * 0.04 }]
    };
  });
  const genesisEvent: WorldEvent = WorldEventSchema.parse({
    id: eventId("PLANET_GENERATED", 0, 0, options.seed),
    planetId: planet.id,
    tick: 0,
    type: "PLANET_GENERATED",
    title: "ميلاد الكوكب",
    description: "تشكلت القارات والمحيطات الأولى من بذرة حتمية.",
    actorIds: [],
    causeEventIds: [`seed:${options.seed}`],
    data: { seed: options.seed, resolution },
    createdAt: now()
  });
  return SimulationStateSchema.parse({
    planet,
    tick: 0,
    species,
    plants: {},
    resources,
    civilizations: {},
    cities: {},
    technologies: {},
    events: [genesisEvent],
    causalLinks: []
  });
}

export function canFoundCivilization(state: SimulationState, regionId: string): boolean {
  const localPopulation = populationInRegion(state, regionId);
  const localResources = Object.values(state.resources).filter((resource) => resource.regionId === regionId);
  const hasFood = localResources.some((resource) => resource.category === "food" && resource.abundance > 0.22);
  const hasWater = localResources.some((resource) => resource.category === "water" && resource.abundance > 0.18);
  const alreadyClaimed = Object.values(state.civilizations).some((civilization) => civilization.regionIds.includes(regionId));
  return localPopulation >= 420 && hasFood && hasWater && !alreadyClaimed;
}

function runClimateModule(state: SimulationState, rng: SeededRandom, serial: () => number): void {
  if (state.tick % 3 !== 0) return;
  const candidates = state.planet.regions.filter((candidate) => candidate.biome !== "deep_ocean");
  const changed: Array<{ regionId: string; temperature: number; moisture: number; pollution: number }> = [];
  for (let i = 0; i < Math.max(2, Math.floor(candidates.length / 80)); i += 1) {
    const region = rng.pick(candidates);
    const tempDelta = rng.range(-0.035, 0.045) + (region.pollution ?? 0) * 0.01;
    const moistureDelta = rng.range(-0.045, 0.04) - (region.pollution ?? 0) * 0.015;
    const pollutionDelta = rng.range(-0.01, 0.018);
    region.temperature = clamp01(region.temperature + tempDelta);
    region.moisture = clamp01(region.moisture + moistureDelta);
    region.pollution = clamp01((region.pollution ?? 0) + pollutionDelta);
    changed.push({ regionId: region.id, temperature: region.temperature, moisture: region.moisture, pollution: region.pollution });
  }
  appendEvent(state, makeEvent(state, "CLIMATE_SHIFTED", serial(), {
    title: "تحول مناخي إقليمي",
    description: "تغيرت الحرارة والرطوبة والتلوث في عدة أقاليم وفق الدورة المناخية.",
    regionId: changed[0]?.regionId,
    data: { regions: changed }
  }));
}

function runPlantsModule(state: SimulationState, rng: SeededRandom, serial: () => number): void {
  const plants = Object.values(state.plants);
  if (plants.length === 0) return;
  const changed: Array<{ id: string; biomass: number; regionId: string; capacityDelta: number; pollutionDelta: number }> = [];
  const newPlants: Plant[] = [];
  for (const plant of plants) {
    const region = state.planet.regions.find((candidate) => candidate.id === plant.regionId);
    if (!region) continue;
    const growth = plant.spreadRate * (0.6 + region.moisture * 0.7 - (region.pollution ?? 0) * 0.35);
    plant.biomass = Number(Math.max(0, plant.biomass + growth * 8).toFixed(2));
    const capacityDelta = Math.round(growth * 4);
    const pollutionDelta = -Math.min(0.012, plant.biomass / 100000);
    region.populationCapacity = Math.max(0, region.populationCapacity + capacityDelta);
    region.pollution = clamp01((region.pollution ?? 0) + pollutionDelta);
    if (changed.length < 25) changed.push({ id: plant.id, biomass: plant.biomass, regionId: plant.regionId, capacityDelta, pollutionDelta: Number(pollutionDelta.toFixed(4)) });
    if (state.tick % 5 === 0 && rng.next() < plant.spreadRate * 0.16 && Object.keys(state.plants).length + newPlants.length < 1000) {
      const target = rng.pick(neighbors(state, plant.regionId).length > 0 ? neighbors(state, plant.regionId) : [region]);
      newPlants.push({
        id: `plant-${state.tick}-${newPlants.length}-${checksum({ from: plant.id, target: target.id })}`,
        planetId: state.planet.id,
        regionId: target.id,
        name: `${plant.name} فرع`,
        biomass: Math.max(4, plant.biomass * 0.12),
        spreadRate: Math.min(1, plant.spreadRate * rng.range(0.9, 1.08)),
        traits: plant.traits
      });
    }
  }
  for (const plant of newPlants) state.plants[plant.id] = plant;
  if (changed.length > 0 || newPlants.length > 0) {
    appendEvent(state, makeEvent(state, "PLANT_SPREAD", serial(), {
      title: "انتشار نباتي",
      description: "امتدت النباتات وغيرت القدرة الحيوية والتلوث المحلي.",
      regionId: changed[0]?.regionId ?? newPlants[0]?.regionId,
      actorIds: [...changed.slice(0, 5).map((item) => item.id), ...newPlants.slice(0, 5).map((plant) => plant.id)],
      data: { changed, newPlants }
    }));
  }
}

function runEcosystemModule(state: SimulationState, serial: () => number): void {
  const changed: Array<{ id: string; population: number; carryingCapacity: number }> = [];
  for (const species of Object.values(state.species)) {
    const region = state.planet.regions.find((candidate) => candidate.id === species.regionId);
    const plantBonus = Object.values(state.plants).filter((plant) => plant.regionId === species.regionId).reduce((sum, plant) => sum + Math.min(0.04, plant.biomass / 50000), 0);
    const growthRate = 0.055 + (region?.moisture ?? 0.4) * 0.035 + plantBonus - (region?.pollution ?? 0) * 0.05;
    species.carryingCapacity = Math.max(20, region?.populationCapacity ?? species.carryingCapacity);
    const nextPopulation = updatePopulation({
      population: species.population,
      growthRate,
      carryingCapacity: species.carryingCapacity,
      predatorPopulation: species.predatorSpeciesIds.length * 6,
      preyPopulation: species.preySpeciesIds.length * 120
    });
    if (nextPopulation !== species.population) {
      species.population = nextPopulation;
      changed.push({ id: species.id, population: nextPopulation, carryingCapacity: species.carryingCapacity });
    }
  }
  if (changed.length > 0) {
    appendEvent(state, makeEvent(state, "SIMULATION_TICKED", serial(), {
      title: "نبضة حياة سنوية",
      description: "تغيرت أعداد الكائنات وفق قدرة البيئة على التحمل.",
      data: { species: changed, tick: state.tick }
    }));
  }
}

function foundCivilization(state: SimulationState, region: PlanetRegion, serial: () => number, index: number): void {
  const localPopulation = populationInRegion(state, region.id);
  const civilization: Civilization = {
    id: `civ-${state.tick}-${index}-${checksum(region.id)}`,
    planetId: state.planet.id,
    name: `حضارة ${index + Object.keys(state.civilizations).length}`,
    foundingTick: state.tick,
    population: Math.max(420, localPopulation),
    regionIds: [region.id],
    cityIds: [`city-${state.tick}-${index}-${checksum(region.id)}`],
    technologyIds: [],
    cultureTags: [region.biome, "river-memory"],
    stability: 0.58 + Math.min(0.3, resourceScore(state, region.id) * 0.03)
  };
  const city: City = {
    id: civilization.cityIds[0]!,
    civilizationId: civilization.id,
    planetId: state.planet.id,
    regionId: region.id,
    name: `مدينة ${region.x}-${region.y}`,
    population: Math.min(600, civilization.population),
    stability: civilization.stability,
    resources: { food: 25, water: 30, knowledge: 4 }
  };
  state.civilizations[civilization.id] = civilization;
  state.cities[city.id] = city;
  appendEvent(state, makeEvent(state, "CIVILIZATION_FOUNDED", serial(), {
    title: "تأسست حضارة جديدة",
    description: "تجمعت جماعات مستقرة حول الغذاء والمياه وبدأت حفظ الذاكرة.",
    regionId: region.id,
    actorIds: [civilization.id],
    data: { civilization, city }
  }));
}

function runCivilizationModule(state: SimulationState, serial: () => number): void {
  if (Object.keys(state.civilizations).length >= 12) return;
  const eligible = state.planet.regions
    .filter((region) => canFoundCivilization(state, region.id))
    .sort((a, b) => populationInRegion(state, b.id) + resourceScore(state, b.id) * 80 - (populationInRegion(state, a.id) + resourceScore(state, a.id) * 80))
    .slice(0, 2);
  eligible.forEach((region, index) => foundCivilization(state, region, serial, index + 1));
}

function runEconomyModule(state: SimulationState, serial: () => number): void {
  const cityUpdates: Array<{ id: string; population: number; resources: Record<string, number> }> = [];
  for (const city of Object.values(state.cities)) {
    const region = state.planet.regions.find((candidate) => candidate.id === city.regionId);
    const growth = Math.max(0, Math.round(city.population * (0.018 + (region?.moisture ?? 0.4) * 0.006 - (region?.pollution ?? 0) * 0.01)));
    city.population += growth;
    city.resources.food = (city.resources.food ?? 0) + 2 + Math.round(resourceScore(state, city.regionId));
    city.resources.knowledge = (city.resources.knowledge ?? 0) + 1;
    const civilization = state.civilizations[city.civilizationId];
    if (civilization) civilization.population = civilization.cityIds.map((id) => state.cities[id]?.population ?? 0).reduce((sum, value) => sum + value, 0);
    cityUpdates.push({ id: city.id, population: city.population, resources: city.resources });
  }
  if (cityUpdates.length > 0 && state.tick % 4 === 0) {
    appendEvent(state, makeEvent(state, "TRADE_ROUTE_OPENED", serial(), {
      title: "توسع تبادل المدن",
      description: "زاد تبادل الغذاء والمعرفة بين المدن والأقاليم المجاورة.",
      actorIds: cityUpdates.slice(0, 8).map((city) => city.id),
      data: { cities: cityUpdates }
    }));
  }
  if (state.tick % 5 === 0) {
    const civ = Object.values(state.civilizations).find((candidate) => candidate.population > 700 && candidate.technologyIds.length < 8);
    if (civ) {
      const technology: Technology = {
        id: `tech-${state.tick}-${checksum(civ.id)}`,
        civilizationId: civ.id,
        name: `تقنية السنة ${state.tick}`,
        level: Math.max(1, Math.floor(state.tick / 10)),
        prerequisites: civ.technologyIds.slice(-2),
        discoveredAtTick: state.tick
      };
      state.technologies[technology.id] = technology;
      civ.technologyIds.push(technology.id);
      appendEvent(state, makeEvent(state, "TECHNOLOGY_DISCOVERED", serial(), {
        title: "اكتشاف تقني",
        description: "حولت مدينة مستقرة المعرفة المتراكمة إلى تقنية جديدة.",
        actorIds: [civ.id, technology.id],
        data: { technology }
      }));
    }
  }
}

function buildRegionGraph(state: SimulationState): Record<string, Array<{ to: string; cost: number }>> {
  const graph: Record<string, Array<{ to: string; cost: number }>> = {};
  for (const region of state.planet.regions) {
    if (region.biome === "deep_ocean") continue;
    graph[region.id] = neighbors(state, region.id).map((target) => ({
      to: target.id,
      cost: 1 + target.elevation * 2 + (target.pollution ?? 0) * 4 + (target.biome.includes("ocean") ? 4 : 0)
    }));
  }
  return graph;
}

function runMigrationModule(state: SimulationState, serial: () => number): void {
  if (state.tick % 6 !== 0) return;
  const stressed = Object.values(state.species).find((species) => {
    const region = state.planet.regions.find((candidate) => candidate.id === species.regionId);
    return region && (species.population > species.carryingCapacity * 0.82 || (region.pollution ?? 0) > 0.45);
  });
  if (!stressed) return;
  const currentRegion = state.planet.regions.find((region) => region.id === stressed.regionId);
  const target = [...state.planet.regions]
    .filter((region) => region.biome !== "deep_ocean" && region.id !== stressed.regionId)
    .sort((a, b) => b.populationCapacity - populationInRegion(state, b.id) - (a.populationCapacity - populationInRegion(state, a.id)))[0];
  if (!currentRegion || !target) return;
  const route = dijkstra(buildRegionGraph(state), currentRegion.id, target.id);
  if (route.path.length < 2 || !Number.isFinite(route.distance)) return;
  const migrating = Math.max(1, Math.round(stressed.population * 0.08));
  stressed.population -= migrating;
  const migrant: Species = {
    ...stressed,
    id: `${stressed.id}-m${state.tick}`,
    regionId: target.id,
    population: migrating,
    carryingCapacity: Math.max(30, target.populationCapacity)
  };
  state.species[migrant.id] = migrant;
  appendEvent(state, makeEvent(state, "MIGRATION_STARTED", serial(), {
    title: "بدأت هجرة بيئية",
    description: "غادرت جماعة موطناً مضغوطاً بحثاً عن قدرة حيوية أعلى.",
    regionId: currentRegion.id,
    actorIds: [stressed.id, migrant.id],
    data: { fromRegionId: currentRegion.id, toRegionId: target.id, speciesId: stressed.id, migrantSpecies: migrant, population: migrating, path: route.path, distance: route.distance }
  }));
}

function runWarModule(state: SimulationState, rng: SeededRandom, serial: () => number): void {
  const civilizations = Object.values(state.civilizations).sort((a, b) => b.population - a.population);
  if (civilizations.length < 2 || state.tick % 4 !== 0) return;
  const [a, b] = civilizations;
  if (!a || !b) return;
  const scarcity = 1 - Math.min(1, (resourceScore(state, a.regionIds[0] ?? "") + resourceScore(state, b.regionIds[0] ?? "")) / 10);
  const probability = scoreWarProbability({
    resourceScarcity: scarcity,
    borderFriction: a.regionIds.some((regionId) => neighbors(state, regionId).some((region) => b.regionIds.includes(region.id))) ? 0.82 : 0.42,
    culturalDistance: Math.abs(a.cultureTags.length - b.cultureTags.length) * 0.08 + 0.35,
    recentWarMemory: state.events.slice(-20).some((event) => event.type === "WAR_STARTED") ? 0.28 : 0.05,
    tradeDependency: 0.12,
    stability: (a.stability + b.stability) / 2
  });
  if (probability > 0.33 && rng.next() < probability) {
    a.stability = clamp01(a.stability - 0.08);
    b.stability = clamp01(b.stability - 0.08);
    appendEvent(state, makeEvent(state, "WAR_STARTED", serial(), {
      title: "اندلاع صراع حدودي",
      description: "تصاعد احتكاك بين حضارتين بسبب الموارد والنفوذ.",
      actorIds: [a.id, b.id],
      data: { probability: Number(probability.toFixed(3)), civilizationIds: [a.id, b.id], stability: { [a.id]: a.stability, [b.id]: b.stability } }
    }));
  }
}

export function runTick(input: SimulationState): SimulationState {
  const state = structuredClone(input) as SimulationState;
  state.tick += 1;
  state.planet.ageYears += 1;
  const serial = serialFactory(state);
  const rng = new SeededRandom(`${state.planet.seed}:${state.tick}`);
  runClimateModule(state, rng, serial);
  runPlantsModule(state, rng, serial);
  runEcosystemModule(state, serial);
  runCivilizationModule(state, serial);
  runEconomyModule(state, serial);
  runMigrationModule(state, serial);
  runWarModule(state, rng, serial);
  return SimulationStateSchema.parse(state);
}

export function runTicks(options: EngineOptions, count: number): SimulationState {
  let state = createInitialState(options);
  for (let i = 0; i < count; i += 1) state = runTick(state);
  return state;
}

function applyRegionPatches(state: SimulationState, patches: Array<{ regionId: string; temperature?: number; moisture?: number; pollution?: number; populationCapacity?: number }>): void {
  for (const patch of patches) {
    const region = state.planet.regions.find((candidate) => candidate.id === patch.regionId);
    if (!region) continue;
    if (patch.temperature !== undefined) region.temperature = clamp01(patch.temperature);
    if (patch.moisture !== undefined) region.moisture = clamp01(patch.moisture);
    if (patch.pollution !== undefined) region.pollution = clamp01(patch.pollution);
    if (patch.populationCapacity !== undefined) region.populationCapacity = Math.max(0, Math.round(patch.populationCapacity));
  }
}

export function applyEvent(state: SimulationState, event: WorldEvent): SimulationState {
  const next = structuredClone(state) as SimulationState;
  switch (event.type) {
    case "SIMULATION_TICKED": {
      next.tick = Number(event.data.tick ?? next.tick + 1);
      next.planet.ageYears = next.tick;
      for (const changed of (event.data.species as Array<{ id: string; population: number; carryingCapacity?: number }> | undefined) ?? []) {
        if (next.species[changed.id]) next.species[changed.id]!.population = changed.population;
        if (next.species[changed.id] && changed.carryingCapacity !== undefined) next.species[changed.id]!.carryingCapacity = changed.carryingCapacity;
      }
      break;
    }
    case "CLIMATE_SHIFTED":
      applyRegionPatches(next, (event.data.regions as Array<{ regionId: string; temperature?: number; moisture?: number; pollution?: number }> | undefined) ?? []);
      break;
    case "PLANT_SPREAD":
      for (const plant of (event.data.newPlants as Plant[] | undefined) ?? []) next.plants[plant.id] = plant;
      for (const changed of (event.data.changed as Array<{ id: string; biomass: number; regionId: string; capacityDelta?: number; pollutionDelta?: number }> | undefined) ?? []) {
        if (next.plants[changed.id]) next.plants[changed.id]!.biomass = changed.biomass;
        const region = next.planet.regions.find((candidate) => candidate.id === changed.regionId);
        if (region) {
          region.populationCapacity = Math.max(0, region.populationCapacity + Math.round(changed.capacityDelta ?? 0));
          region.pollution = clamp01((region.pollution ?? 0) + Number(changed.pollutionDelta ?? 0));
        }
      }
      break;
    case "CIVILIZATION_FOUNDED": {
      const civilization = event.data.civilization as Civilization | undefined;
      const city = event.data.city as City | undefined;
      if (civilization) next.civilizations[civilization.id] = civilization;
      if (city) next.cities[city.id] = city;
      break;
    }
    case "CITY_FOUNDED": {
      const city = event.data.city as City | undefined;
      if (city) {
        next.cities[city.id] = city;
        const civ = next.civilizations[city.civilizationId];
        if (civ && !civ.cityIds.includes(city.id)) civ.cityIds.push(city.id);
      }
      break;
    }
    case "TRADE_ROUTE_OPENED":
      for (const changed of (event.data.cities as Array<{ id: string; population: number; resources: Record<string, number> }> | undefined) ?? []) {
        if (next.cities[changed.id]) {
          next.cities[changed.id]!.population = changed.population;
          next.cities[changed.id]!.resources = changed.resources;
        }
      }
      break;
    case "TECHNOLOGY_DISCOVERED": {
      const technology = event.data.technology as Technology | undefined;
      if (technology) {
        next.technologies[technology.id] = technology;
        const civ = next.civilizations[technology.civilizationId];
        if (civ && !civ.technologyIds.includes(technology.id)) civ.technologyIds.push(technology.id);
      }
      break;
    }
    case "MIGRATION_STARTED": {
      const speciesId = event.data.speciesId as string | undefined;
      const population = Number(event.data.population ?? 0);
      const migrantSpecies = event.data.migrantSpecies as Species | undefined;
      if (speciesId && next.species[speciesId]) next.species[speciesId]!.population = Math.max(0, next.species[speciesId]!.population - population);
      if (migrantSpecies) next.species[migrantSpecies.id] = migrantSpecies;
      break;
    }
    case "WAR_STARTED":
      for (const [id, stability] of Object.entries((event.data.stability as Record<string, number> | undefined) ?? {})) {
        if (next.civilizations[id]) next.civilizations[id]!.stability = clamp01(Number(stability));
      }
      break;
    case "RESOURCE_DISCOVERED": {
      for (const resource of (event.data.resources as Resource[] | undefined) ?? []) next.resources[resource.id] = resource;
      const resource = event.data.resource as Resource | undefined;
      if (resource) next.resources[resource.id] = resource;
      break;
    }
    case "SPECIES_CREATED": {
      const species = event.data.species as Species | undefined;
      if (species) next.species[species.id] = species;
      break;
    }
    case "DISEASE_OUTBREAK":
      for (const changed of (event.data.species as Array<{ id: string; population: number }> | undefined) ?? []) {
        if (next.species[changed.id]) next.species[changed.id]!.population = changed.population;
      }
      break;
    case "CULTURE_EMERGED":
      for (const id of (event.data.civilizationIds as string[] | undefined) ?? []) {
        if (next.civilizations[id]) next.civilizations[id]!.cultureTags.push(String(event.data.tag ?? "new-culture"));
      }
      break;
    case "WORLD_LAW_CHANGED":
      applyRegionPatches(next, (event.data.regions as Array<{ regionId: string; populationCapacity?: number; pollution?: number }> | undefined) ?? []);
      break;
    case "CONTRIBUTION_APPLIED":
    case "PLANET_GENERATED":
    case "WAR_ENDED":
    case "VOLCANO_ERUPTED":
      break;
  }
  if (!next.events.some((candidate) => candidate.id === event.id)) appendEvent(next, event);
  return SimulationStateSchema.parse(next);
}

export function replayEvents(options: EngineOptions, events: WorldEvent[]): SimulationState {
  let state = createInitialState(options);
  for (const event of events) {
    if (event.type === "PLANET_GENERATED") continue;
    state = applyEvent(state, event);
  }
  return SimulationStateSchema.parse(state);
}

function suitableRegions(state: SimulationState, category: string): PlanetRegion[] {
  return state.planet.regions
    .filter((region) => region.biome !== "deep_ocean" && region.biome !== "ice_cap")
    .filter((region) => category !== "plant" || region.moisture > 0.22)
    .filter((region) => category !== "civilization" || resourceScore(state, region.id) > 1.3)
    .sort((a, b) => b.populationCapacity + b.moisture * 100 - (a.populationCapacity + a.moisture * 100));
}

export function applyContribution(input: SimulationState, contribution: UserContribution): ApplyContributionResult {
  let state = structuredClone(input) as SimulationState;
  const payload = contribution.structuredPayload as Record<string, unknown>;
  const category = contribution.category;
  const chosenRegionId = String(payload.targetRegionId ?? payload.regionId ?? "");
  const region = state.planet.regions.find((candidate) => candidate.id === chosenRegionId) ?? suitableRegions(state, category)[0] ?? state.planet.regions[0]!;
  const events: WorldEvent[] = [];
  const serial = serialFactory(state);
  const applied = appendEvent(state, makeEvent(state, "CONTRIBUTION_APPLIED", `contribution-${contribution.id}`, {
    title: "تم تطبيق مساهمة",
    description: `دخلت مساهمة المستخدم إلى المحاكاة: ${contribution.prompt}`,
    regionId: region.id,
    actorIds: [contribution.id, contribution.userId],
    data: { contributionId: contribution.id, category, targetRegionId: region.id, payload }
  }));
  events.push(applied);
  const causeEventIds = [applied.id];
  const name = String(payload.name ?? contribution.prompt.slice(0, 40));
  const traits = Array.isArray(payload.traits) ? payload.traits as Array<{ name: string; value: number; description?: string }> : [];

  if (category === "creature") {
    const species: Species = { id: `contrib-species-${contribution.id}`, planetId: state.planet.id, regionId: region.id, name, population: 90, carryingCapacity: Math.max(120, region.populationCapacity), preySpeciesIds: [], predatorSpeciesIds: [], traits, createdByContributionId: contribution.id };
    state.species[species.id] = species;
    events.push(appendEvent(state, makeEvent(state, "SPECIES_CREATED", serial(), { title: "نشأ نوع جديد", description: `ظهر النوع ${name} في ${region.id}.`, regionId: region.id, actorIds: [species.id, contribution.id], causeEventIds, data: { species } })));
  } else if (category === "plant") {
    const plant: Plant = { id: `contrib-plant-${contribution.id}`, planetId: state.planet.id, regionId: region.id, name, biomass: 35, spreadRate: 0.28, traits, createdByContributionId: contribution.id };
    state.plants[plant.id] = plant;
    region.populationCapacity += 20;
    region.pollution = clamp01((region.pollution ?? 0) - 0.02);
    events.push(appendEvent(state, makeEvent(state, "PLANT_SPREAD", serial(), { title: "زرع نبات جديد", description: `بدأ النبات ${name} بالتجذر والتأثير في البيئة.`, regionId: region.id, actorIds: [plant.id, contribution.id], causeEventIds, data: { newPlants: [plant], changed: [{ id: plant.id, biomass: plant.biomass, regionId: region.id, capacityDelta: 20, pollutionDelta: -0.02 }] } })));
  } else if (category === "resource") {
    const resource: Resource = { id: `contrib-resource-${contribution.id}`, planetId: state.planet.id, regionId: region.id, name, category: "mineral", abundance: 0.62, renewability: 0.15, discoveredAtTick: state.tick };
    state.resources[resource.id] = resource;
    region.resources.push(resource);
    events.push(appendEvent(state, makeEvent(state, "RESOURCE_DISCOVERED", serial(), { title: "اكتشاف مورد", description: `اكتشف السكان ${name}.`, regionId: region.id, actorIds: [resource.id, contribution.id], causeEventIds, data: { resource } })));
  } else if (category === "civilization") {
    const canFound = canFoundCivilization(state, region.id) || resourceScore(state, region.id) > 1.2;
    if (canFound) foundCivilization(state, region, serial, Object.keys(state.civilizations).length + 1);
    const event = state.events.at(-1);
    if (event && event.causeEventIds.includes(applied.id) === false && event.type === "CIVILIZATION_FOUNDED") event.causeEventIds = [applied.id];
    if (event?.type === "CIVILIZATION_FOUNDED") events.push(event);
  } else if (category === "invention") {
    const civ = Object.values(state.civilizations)[0];
    if (civ) {
      const technology: Technology = { id: `contrib-tech-${contribution.id}`, civilizationId: civ.id, name, level: 1 + Math.floor(state.tick / 20), prerequisites: civ.technologyIds.slice(-2), discoveredAtTick: state.tick };
      state.technologies[technology.id] = technology;
      civ.technologyIds.push(technology.id);
      events.push(appendEvent(state, makeEvent(state, "TECHNOLOGY_DISCOVERED", serial(), { title: "اختراع جديد", description: `تحول الاقتراح إلى تقنية: ${name}.`, regionId: region.id, actorIds: [technology.id, civ.id, contribution.id], causeEventIds, data: { technology } })));
    }
  } else if (category === "natural_phenomenon") {
    region.temperature = clamp01(region.temperature + 0.08);
    region.pollution = clamp01((region.pollution ?? 0) + 0.05);
    events.push(appendEvent(state, makeEvent(state, "VOLCANO_ERUPTED", serial(), { title: "ظاهرة طبيعية مؤثرة", description: `${name} غيرت حرارة وتلوث الإقليم.`, regionId: region.id, actorIds: [contribution.id], causeEventIds, data: { regions: [{ regionId: region.id, temperature: region.temperature, pollution: region.pollution }] } })));
  } else if (category === "disease") {
    const affected = Object.values(state.species).filter((species) => species.regionId === region.id).slice(0, 4).map((species) => {
      species.population = Math.max(0, Math.round(species.population * 0.86));
      return { id: species.id, population: species.population };
    });
    events.push(appendEvent(state, makeEvent(state, "DISEASE_OUTBREAK", serial(), { title: "تفشي مرض", description: `${name} خفض أعداد بعض الأنواع.`, regionId: region.id, actorIds: [contribution.id, ...affected.map((item) => item.id)], causeEventIds, data: { species: affected } })));
  } else if (category === "culture") {
    const civIds = Object.values(state.civilizations).slice(0, 3).map((civ) => civ.id);
    for (const id of civIds) state.civilizations[id]?.cultureTags.push(name);
    events.push(appendEvent(state, makeEvent(state, "CULTURE_EMERGED", serial(), { title: "ظهور ثقافة", description: `انتشر أثر ثقافي جديد: ${name}.`, regionId: region.id, actorIds: [contribution.id, ...civIds], causeEventIds, data: { tag: name, civilizationIds: civIds } })));
  } else {
    const patches = neighbors(state, region.id).slice(0, 6).map((candidate) => ({ regionId: candidate.id, populationCapacity: Math.round(candidate.populationCapacity * 1.03), pollution: clamp01((candidate.pollution ?? 0) * 0.98) }));
    applyRegionPatches(state, patches);
    events.push(appendEvent(state, makeEvent(state, "WORLD_LAW_CHANGED", serial(), { title: "تغير قانون عالمي", description: `${name} عدل شروط الحياة في عدة أقاليم.`, regionId: region.id, actorIds: [contribution.id], causeEventIds, data: { regions: patches } })));
  }
  return { state: SimulationStateSchema.parse(state), events };
}

export function snapshot(state: SimulationState): TimelineSnapshot {
  return {
    id: `snapshot-${state.tick}-${checksum(state)}`,
    planetId: state.planet.id,
    tick: state.tick,
    stateChecksum: checksum(state),
    summary: `Year ${state.planet.ageYears}: ${state.events.length} causal events recorded, ${Object.keys(state.civilizations).length} civilizations active.`,
    events: state.events.slice(-40),
    species: Object.values(state.species),
    civilizations: Object.values(state.civilizations),
    createdAt: now()
  };
}

function speciesList(value: SimulationState | TimelineSnapshot): Species[] {
  return "planet" in value ? Object.values(value.species) : (value.species as Species[]);
}

function civilizationCount(value: SimulationState | TimelineSnapshot): number {
  return "planet" in value ? Object.keys(value.civilizations).length : value.civilizations.length;
}

export function compareSnapshots(before: SimulationState | TimelineSnapshot, after: SimulationState | TimelineSnapshot): SnapshotComparison {
  const beforeState = "planet" in before ? before : undefined;
  const afterState = "planet" in after ? after : undefined;
  const beforeEvents = beforeState?.events ?? before.events;
  const afterEvents = afterState?.events ?? after.events;
  const beforePopulation = beforeState ? totalPopulation(beforeState) : speciesList(before).reduce((sum, species) => sum + species.population, 0);
  const afterPopulation = afterState ? totalPopulation(afterState) : speciesList(after).reduce((sum, species) => sum + species.population, 0);
  const beforeCivilizations = civilizationCount(before);
  const afterCivilizations = civilizationCount(after);
  const beforeSpecies = speciesList(before).length;
  const afterSpecies = speciesList(after).length;
  const newEvents = afterEvents.filter((event) => !beforeEvents.some((candidate) => candidate.id === event.id));
  const newEventTypes = newEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
  return {
    beforeTick: before.tick,
    afterTick: after.tick,
    populationDelta: afterPopulation - beforePopulation,
    civilizationDelta: afterCivilizations - beforeCivilizations,
    cityDelta: (afterState ? Object.keys(afterState.cities).length : 0) - (beforeState ? Object.keys(beforeState.cities).length : 0),
    speciesDelta: afterSpecies - beforeSpecies,
    plantDelta: (afterState ? Object.keys(afterState.plants).length : 0) - (beforeState ? Object.keys(beforeState.plants).length : 0),
    eventDelta: newEvents.length,
    averagePollutionDelta: (afterState ? averagePollution(afterState) : 0) - (beforeState ? averagePollution(beforeState) : 0),
    newEventTypes
  };
}

export function runFutureScenarios(state: SimulationState, years: number, runs: number): FutureScenarios {
  const scenarios: FutureScenario[] = [];
  for (let run = 0; run < runs; run += 1) {
    let fork = structuredClone(state) as SimulationState;
    fork.planet.seed = `${state.planet.seed}:scenario:${run}`;
    for (let year = 0; year < years; year += 1) fork = runTick(fork);
    const wars = fork.events.filter((event) => event.type === "WAR_STARTED").length - state.events.filter((event) => event.type === "WAR_STARTED").length;
    const population = totalPopulation(fork);
    const civilizations = Object.keys(fork.civilizations).length;
    const score = population + civilizations * 1000 - wars * 500 - averagePollution(fork) * 1000;
    scenarios.push({ run, score, finalTick: fork.tick, population, civilizations, wars, events: fork.events.length - state.events.length, summary: `${civilizations} civs, ${population} population, ${wars} new wars` });
  }
  const sorted = [...scenarios].sort((a, b) => a.score - b.score);
  const best = sorted.at(-1)!;
  const worst = sorted[0]!;
  const mean = scenarios.reduce((sum, scenario) => sum + scenario.score, 0) / Math.max(1, scenarios.length);
  const mostLikely = [...scenarios].sort((a, b) => Math.abs(a.score - mean) - Math.abs(b.score - mean))[0]!;
  const variance = scenarios.reduce((sum, scenario) => sum + Math.pow(scenario.score - mean, 2), 0) / Math.max(1, scenarios.length);
  return { years, runs, mostLikely, best, worst, uncertainty: Number(Math.sqrt(variance).toFixed(2)), scenarios };
}

export function serializeState(state: SimulationState): string {
  return JSON.stringify(state);
}

export function deserializeState(serialized: string | object): SimulationState {
  return SimulationStateSchema.parse(typeof serialized === "string" ? JSON.parse(serialized) : serialized);
}

export function createRichDemoState(seed = "kawkab-rich-demo", resolution = 24, ticks = 60): SimulationState {
  let state = createInitialState({ seed, resolution });
  const rng = new SeededRandom(`${seed}:rich-demo`);
  const habitable = state.planet.regions.filter((region) => region.biome !== "deep_ocean" && region.biome !== "ice_cap" && region.populationCapacity > 40);
  const serial = serialFactory(state);

  while (Object.keys(state.resources).length < 120) {
    const region = rng.pick(habitable);
    const id = `demo-resource-${Object.keys(state.resources).length}`;
    const resource: Resource = { id, planetId: state.planet.id, regionId: region.id, name: `مورد ${id}`, category: rng.pick(["food", "water", "mineral", "energy", "medicine"] as const), abundance: rng.range(0.25, 0.95), renewability: rng.range(0.05, 0.95), discoveredAtTick: 0 };
    state.resources[id] = resource;
    region.resources.push(resource);
  }
  appendEvent(state, makeEvent(state, "RESOURCE_DISCOVERED", serial(), { title: "خريطة موارد أولية", description: "كشفت المسوحات الأولى عشرات الموارد الأساسية.", data: { resources: Object.values(state.resources).slice(0, 140) } }));

  for (let i = Object.keys(state.plants).length; i < 800; i += 1) {
    const region = rng.pick(habitable);
    const plant: Plant = { id: `demo-plant-${i}`, planetId: state.planet.id, regionId: region.id, name: `نبات ${i}`, biomass: rng.range(8, 80), spreadRate: rng.range(0.08, 0.38), traits: [{ name: "adaptation", value: rng.range(0.2, 0.8) }] };
    state.plants[plant.id] = plant;
    region.populationCapacity += Math.round(plant.biomass * 0.08);
  }
  appendEvent(state, makeEvent(state, "PLANT_SPREAD", serial(), { title: "غطاء نباتي غني", description: "انتشرت مئات النباتات المؤسسة في الأقاليم الحية.", data: { newPlants: Object.values(state.plants).slice(0, 60), changed: [] } }));

  for (let i = Object.keys(state.species).length; i < 300; i += 1) {
    const region = rng.pick(habitable);
    const capacity = Math.max(80, Math.round(region.populationCapacity * rng.range(0.4, 1.1)));
    const species: Species = { id: `demo-species-${i}`, planetId: state.planet.id, regionId: region.id, name: `نوع ${i}`, population: rng.int(35, Math.max(60, Math.min(800, capacity))), carryingCapacity: capacity, preySpeciesIds: [], predatorSpeciesIds: [], traits: [{ name: "resilience", value: rng.range(0.2, 0.8) }] };
    state.species[species.id] = species;
  }
  appendEvent(state, makeEvent(state, "SPECIES_CREATED", serial(), { title: "تنوع حيوي واسع", description: "استقرت مئات الأنواع في شبكة غذائية أولية.", data: { count: Object.keys(state.species).length } }));

  const civRegions = [...habitable].sort((a, b) => b.populationCapacity + resourceScore(state, b.id) * 100 - (a.populationCapacity + resourceScore(state, a.id) * 100)).slice(0, 12);
  civRegions.forEach((region, index) => {
    for (const species of Object.values(state.species).filter((species) => species.regionId === region.id).slice(0, 3)) species.population = Math.max(species.population, 520);
    foundCivilization(state, region, serial, index + 1);
  });
  const civs = Object.values(state.civilizations);
  for (let i = Object.keys(state.cities).length; i < 40; i += 1) {
    const civ = civs[i % civs.length]!;
    const baseRegion = state.planet.regions.find((region) => region.id === civ.regionIds[0])!;
    const region = rng.pick(neighbors(state, baseRegion.id).length > 0 ? neighbors(state, baseRegion.id) : [baseRegion]);
    const city: City = { id: `demo-city-${i}`, civilizationId: civ.id, planetId: state.planet.id, regionId: region.id, name: `مدينة demo ${i}`, population: rng.int(180, 1200), stability: rng.range(0.45, 0.88), resources: { food: rng.int(10, 90), water: rng.int(10, 90), knowledge: rng.int(1, 30) } };
    state.cities[city.id] = city;
    civ.cityIds.push(city.id);
    if (!civ.regionIds.includes(region.id)) civ.regionIds.push(region.id);
  }
  appendEvent(state, makeEvent(state, "CITY_FOUNDED", serial(), { title: "شبكة مدن أولى", description: "نشأت أربعون مدينة بين الأنهار والسهول والغابات.", actorIds: Object.keys(state.cities).slice(0, 40), data: { count: Object.keys(state.cities).length } }));

  for (let i = 0; i < 50; i += 1) {
    const civ = civs[i % civs.length]!;
    const technology: Technology = { id: `demo-tech-${i}`, civilizationId: civ.id, name: `تقنية demo ${i}`, level: 1 + Math.floor(i / 10), prerequisites: civ.technologyIds.slice(-2), discoveredAtTick: 0 };
    state.technologies[technology.id] = technology;
    civ.technologyIds.push(technology.id);
  }
  appendEvent(state, makeEvent(state, "TECHNOLOGY_DISCOVERED", serial(), { title: "أرشيف تقنيات تأسيسي", description: "بدأت الحضارات بخمسين تقنية قابلة للتطور.", actorIds: Object.keys(state.technologies).slice(0, 50), data: { count: Object.keys(state.technologies).length } }));

  for (let i = 0; i < ticks; i += 1) state = runTick(state);
  return SimulationStateSchema.parse(state);
}

export class SimulationEngine {
  private history: SimulationState[];

  constructor(private readonly options: EngineOptions, initialState?: SimulationState) {
    this.history = [initialState ? SimulationStateSchema.parse(initialState) : createInitialState(options)];
  }

  get state(): SimulationState {
    return this.history[this.history.length - 1]!;
  }

  setState(state: SimulationState): void {
    this.history = [SimulationStateSchema.parse(state)];
  }

  tick(): SimulationState {
    const next = runTick(this.state);
    this.history.push(next);
    return next;
  }

  applyContribution(contribution: UserContribution): ApplyContributionResult {
    const result = applyContribution(this.state, contribution);
    this.history.push(result.state);
    return result;
  }

  record(state: SimulationState): void {
    this.history.push(SimulationStateSchema.parse(state));
  }

  rollback(toTick: number): SimulationState {
    const found = this.history.find((state) => state.tick === toTick);
    if (!found) throw new Error(`No snapshot for tick ${toTick}`);
    this.history = this.history.filter((state) => state.tick <= toTick);
    return found;
  }

  snapshots(): TimelineSnapshot[] {
    return this.history.map(snapshot);
  }
}
