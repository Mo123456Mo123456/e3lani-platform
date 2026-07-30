import type { Civilization, City, Planet, Resource, SimulationState, Species, TimelineSnapshot, WorldEvent } from "@kawkab/shared-types";
import { SimulationStateSchema, WorldEventSchema } from "@kawkab/shared-types";
import { checksum, SeededRandom, scoreWarProbability, updatePopulation } from "@kawkab/simulation-models";
import { generatePlanet } from "@kawkab/world-generator";

export interface EngineOptions {
  seed: string;
  resolution?: number;
  yearLength?: number;
}

function now(): string {
  return new Date(0).toISOString();
}

function eventId(type: string, tick: number, serial: number, seed: string): string {
  return `event-${tick}-${serial}-${checksum({ type, tick, serial, seed })}`;
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
    .filter((region) => region.populationCapacity > 200 && region.resources.some((resource) => resource.category === "food" || resource.category === "water"))
    .sort((a, b) => b.populationCapacity - a.populationCapacity)
    .slice(0, 3);
  const species: Record<string, Species> = {};
  bestRegions.forEach((region, index) => {
    const capacity = Math.max(120, Math.round(region.populationCapacity * 0.75));
    species[`species-${index + 1}`] = {
      id: `species-${index + 1}`,
      planetId: planet.id,
      regionId: region.id,
      name: index === 0 ? "رعاة الفجر" : `Species ${index + 1}`,
      population: Math.min(capacity, 80 + index * 55),
      carryingCapacity: capacity,
      preySpeciesIds: [],
      predatorSpeciesIds: [],
      traits: [{ name: "resilience", value: 0.42 + index * 0.08 }]
    };
  });
  const genesisEvent: WorldEvent = WorldEventSchema.parse({
    id: eventId("PLANET_GENERATED", 0, 0, options.seed),
    planetId: planet.id,
    tick: 0,
    type: "PLANET_GENERATED",
    title: "ميلاد الكوكب",
    description: "تشكلت القارات والمحيطات الأولى من بذرة حتمية.",
    causeEventIds: [`seed:${options.seed}`],
    data: { seed: options.seed, resolution },
    createdAt: now()
  });
  return {
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
  };
}

export function canFoundCivilization(state: SimulationState, regionId: string): boolean {
  const localPopulation = Object.values(state.species)
    .filter((species) => species.regionId === regionId)
    .reduce((sum, species) => sum + species.population, 0);
  const localResources = Object.values(state.resources).filter((resource) => resource.regionId === regionId);
  const hasFood = localResources.some((resource) => resource.category === "food" && resource.abundance > 0.25);
  const hasWater = localResources.some((resource) => resource.category === "water" && resource.abundance > 0.2);
  return localPopulation >= 500 && hasFood && hasWater;
}

function appendEvent(state: SimulationState, event: WorldEvent): void {
  const parsed = WorldEventSchema.parse(event);
  state.events.push(parsed);
  for (const causeId of parsed.causeEventIds) {
    state.causalLinks.push({ id: `${causeId}->${parsed.id}`, fromEventId: causeId, toEventId: parsed.id, reason: parsed.description, weight: 1 });
  }
}

function runClimateModule(state: SimulationState, rng: SeededRandom, serial: () => number): void {
  if (state.tick % 7 !== 0) return;
  const region = rng.pick(state.planet.regions.filter((candidate) => candidate.biome !== "deep_ocean"));
  appendEvent(state, {
    id: eventId("CLIMATE_SHIFTED", state.tick, serial(), state.planet.seed),
    planetId: state.planet.id,
    tick: state.tick,
    type: "CLIMATE_SHIFTED",
    title: "تحول مناخي محدود",
    description: `تغيرت الرطوبة حول ${region.id} بمقدار صغير مؤثر.`,
    regionId: region.id,
    actorIds: [],
    causeEventIds: [state.events.at(-1)?.id ?? `seed:${state.planet.seed}`],
    data: { moistureDelta: Number(rng.range(-0.04, 0.04).toFixed(3)) },
    createdAt: now()
  });
}

function runEcosystemModule(state: SimulationState, serial: () => number): void {
  const changed: Array<{ id: string; population: number }> = [];
  for (const species of Object.values(state.species)) {
    const region = state.planet.regions.find((candidate) => candidate.id === species.regionId);
    const growthRate = 0.08 + (region?.moisture ?? 0.4) * 0.04;
    const nextPopulation = updatePopulation({
      population: species.population,
      growthRate,
      carryingCapacity: species.carryingCapacity,
      predatorPopulation: species.predatorSpeciesIds.length * 6,
      preyPopulation: species.preySpeciesIds.length * 120
    });
    if (nextPopulation !== species.population) {
      species.population = nextPopulation;
      changed.push({ id: species.id, population: nextPopulation });
    }
  }
  if (changed.length > 0) {
    appendEvent(state, {
      id: eventId("SIMULATION_TICKED", state.tick, serial(), state.planet.seed),
      planetId: state.planet.id,
      tick: state.tick,
      type: "SIMULATION_TICKED",
      title: "نبضة حياة سنوية",
      description: "تغيرت أعداد الكائنات وفق قدرة البيئة على التحمل.",
    actorIds: [],
      causeEventIds: [state.events.at(-1)?.id ?? `seed:${state.planet.seed}`],
      data: { species: changed, tick: state.tick },
      createdAt: now()
    });
  }
}

function runCivilizationModule(state: SimulationState, serial: () => number): void {
  if (Object.keys(state.civilizations).length > 0) return;
  const region = state.planet.regions.find((candidate) => canFoundCivilization(state, candidate.id));
  if (!region) return;
  const civilization: Civilization = {
    id: `civ-${state.tick}-1`,
    planetId: state.planet.id,
    name: "مدن النهر الأول",
    foundingTick: state.tick,
    population: Object.values(state.species).filter((species) => species.regionId === region.id).reduce((sum, species) => sum + species.population, 0),
    regionIds: [region.id],
    cityIds: [`city-${state.tick}-1`],
    technologyIds: [],
    cultureTags: ["river", "observatory"],
    stability: 0.68
  };
  const city: City = {
    id: `city-${state.tick}-1`,
    civilizationId: civilization.id,
    planetId: state.planet.id,
    regionId: region.id,
    name: "مرسى الفجر",
    population: Math.min(260, civilization.population),
    stability: 0.72,
    resources: { food: 20, water: 30 }
  };
  state.civilizations[civilization.id] = civilization;
  state.cities[city.id] = city;
  appendEvent(state, {
    id: eventId("CIVILIZATION_FOUNDED", state.tick, serial(), state.planet.seed),
    planetId: state.planet.id,
    tick: state.tick,
    type: "CIVILIZATION_FOUNDED",
    title: "تأسست حضارة أولى",
    description: "تجمعت جماعات مستقرة قرب الغذاء والمياه وبدأت حفظ الذاكرة.",
    regionId: region.id,
    actorIds: [civilization.id],
    causeEventIds: [state.events.at(-1)?.id ?? `seed:${state.planet.seed}`],
    data: { civilization, city },
    createdAt: now()
  });
}

function runEconomyModule(state: SimulationState, serial: () => number): void {
  if (state.tick % 4 !== 0 || Object.keys(state.cities).length < 1) return;
  const city = Object.values(state.cities)[0];
  if (!city) return;
  city.resources.food = (city.resources.food ?? 0) + 3;
  appendEvent(state, {
    id: eventId("TRADE_ROUTE_OPENED", state.tick, serial(), state.planet.seed),
    planetId: state.planet.id,
    tick: state.tick,
    type: "TRADE_ROUTE_OPENED",
    title: "طريق تبادل محلي",
    description: "بدأت المدينة تبادل الغذاء والمعرفة مع محيطها القريب.",
    regionId: city.regionId,
    actorIds: [city.id],
    causeEventIds: [state.events.at(-1)?.id ?? `seed:${state.planet.seed}`],
    data: { cityId: city.id, foodDelta: 3 },
    createdAt: now()
  });
}

function runWarModule(state: SimulationState, rng: SeededRandom, serial: () => number): void {
  const civilizations = Object.values(state.civilizations);
  if (civilizations.length < 2 || state.tick % 6 !== 0) return;
  const probability = scoreWarProbability({ resourceScarcity: 0.4, borderFriction: 0.5, culturalDistance: 0.3, recentWarMemory: 0.1, tradeDependency: 0.2, stability: civilizations[0]?.stability ?? 0.5 });
  if (rng.next() < probability) {
    appendEvent(state, {
      id: eventId("WAR_STARTED", state.tick, serial(), state.planet.seed),
      planetId: state.planet.id,
      tick: state.tick,
      type: "WAR_STARTED",
      title: "اندلاع صراع حدودي",
      description: "تصاعد احتكاك حدودي بسبب موارد محدودة.",
      actorIds: civilizations.slice(0, 2).map((civilization) => civilization.id),
      causeEventIds: [state.events.at(-1)?.id ?? `seed:${state.planet.seed}`],
      data: { probability: Number(probability.toFixed(3)) },
      createdAt: now()
    });
  }
}

export function runTick(input: SimulationState): SimulationState {
  const state = structuredClone(input) as SimulationState;
  state.tick += 1;
  state.planet.ageYears += 1;
  let serialValue = 1;
  const serial = () => serialValue++;
  const rng = new SeededRandom(`${state.planet.seed}:${state.tick}`);
  runClimateModule(state, rng, serial);
  runEcosystemModule(state, serial);
  runCivilizationModule(state, serial);
  runEconomyModule(state, serial);
  runWarModule(state, rng, serial);
  return SimulationStateSchema.parse(state);
}

export function runTicks(options: EngineOptions, count: number): SimulationState {
  let state = createInitialState(options);
  for (let i = 0; i < count; i += 1) state = runTick(state);
  return state;
}

export function applyEvent(state: SimulationState, event: WorldEvent): SimulationState {
  const next = structuredClone(state) as SimulationState;
  if (event.type === "SIMULATION_TICKED") {
    next.tick = Number(event.data.tick ?? next.tick + 1);
    next.planet.ageYears = next.tick;
    for (const changed of (event.data.species as Array<{ id: string; population: number }> | undefined) ?? []) {
      if (next.species[changed.id]) next.species[changed.id]!.population = changed.population;
    }
  }
  if (event.type === "CIVILIZATION_FOUNDED") {
    const civilization = event.data.civilization as Civilization | undefined;
    const city = event.data.city as City | undefined;
    if (civilization) next.civilizations[civilization.id] = civilization;
    if (city) next.cities[city.id] = city;
  }
  if (event.type === "TRADE_ROUTE_OPENED") {
    const cityId = event.data.cityId as string | undefined;
    if (cityId && next.cities[cityId]) next.cities[cityId]!.resources.food = (next.cities[cityId]!.resources.food ?? 0) + Number(event.data.foodDelta ?? 0);
  }
  if (!next.events.some((candidate) => candidate.id === event.id)) appendEvent(next, event);
  return next;
}

export function replayEvents(options: EngineOptions, events: WorldEvent[]): SimulationState {
  let state = createInitialState(options);
  for (const event of events) {
    if (event.type === "PLANET_GENERATED") continue;
    state = applyEvent(state, event);
  }
  return SimulationStateSchema.parse(state);
}

export function snapshot(state: SimulationState): TimelineSnapshot {
  return {
    id: `snapshot-${state.tick}-${checksum(state)}`,
    planetId: state.planet.id,
    tick: state.tick,
    stateChecksum: checksum(state),
    summary: `Year ${state.planet.ageYears}: ${state.events.length} causal events recorded.`,
    events: state.events.slice(-20),
    species: Object.values(state.species),
    civilizations: Object.values(state.civilizations),
    createdAt: now()
  };
}

export class SimulationEngine {
  private history: SimulationState[];

  constructor(private readonly options: EngineOptions) {
    this.history = [createInitialState(options)];
  }

  get state(): SimulationState {
    return this.history[this.history.length - 1]!;
  }

  tick(): SimulationState {
    const next = runTick(this.state);
    this.history.push(next);
    return next;
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
