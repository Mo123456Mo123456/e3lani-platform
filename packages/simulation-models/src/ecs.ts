/**
 * Minimal Entity-Component-System for the planet simulation.
 */

export type EntityId = number;

export interface ComponentStore<T> {
  has(entity: EntityId): boolean;
  get(entity: EntityId): T | undefined;
  set(entity: EntityId, value: T): void;
  delete(entity: EntityId): boolean;
  entries(): IterableIterator<[EntityId, T]>;
  size: number;
}

export function createStore<T>(): ComponentStore<T> {
  const map = new Map<EntityId, T>();
  return {
    has: (e) => map.has(e),
    get: (e) => map.get(e),
    set: (e, v) => {
      map.set(e, v);
    },
    delete: (e) => map.delete(e),
    entries: () => map.entries(),
    get size() {
      return map.size;
    },
  };
}

export interface Position {
  lat: number;
  lon: number;
}

export interface Population {
  count: number;
  carryingCapacity: number;
  growthRate: number;
}

export interface SpeciesTraitsComponent {
  size: number;
  speed: number;
  strength: number;
  intelligence: number;
  reproductionRate: number;
  lifespan: number;
  diet: "herbivore" | "carnivore" | "omnivore" | "producer";
  aggression: number;
  adaptability: number;
  preyOf: EntityId[];
  predatorsOf: EntityId[];
}

export interface CivStats {
  name: string;
  techLevel: number;
  militaryPower: number;
  economyStrength: number;
  aggression: number;
  expansionism: number;
  diplomacy: number;
  foodStock: number;
}

export interface ResourceStock {
  resourceId: string;
  amount: number;
  maxAmount: number;
  renewRate: number;
}

export interface ClimateCell {
  temperature: number;
  moisture: number;
  pollution: number;
  fire: boolean;
  drought: boolean;
  flood: boolean;
}

export interface System {
  name: string;
  update(world: World, dt: number): void;
}

export class World {
  private nextId = 1;
  private readonly alive = new Set<EntityId>();
  readonly positions = createStore<Position>();
  readonly populations = createStore<Population>();
  readonly speciesTraits = createStore<SpeciesTraitsComponent>();
  readonly civStats = createStore<CivStats>();
  readonly resources = createStore<ResourceStock>();
  readonly climate = createStore<ClimateCell>();
  private readonly systems: System[] = [];

  createEntity(): EntityId {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    this.alive.delete(id);
    this.positions.delete(id);
    this.populations.delete(id);
    this.speciesTraits.delete(id);
    this.civStats.delete(id);
    this.resources.delete(id);
    this.climate.delete(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  entities(): IterableIterator<EntityId> {
    return this.alive.values();
  }

  entityCount(): number {
    return this.alive.size;
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  tick(dt: number): void {
    for (const s of this.systems) s.update(this, dt);
  }

  snapshot(): WorldSnapshot {
    return {
      nextId: this.nextId,
      entities: [...this.alive],
      positions: Object.fromEntries(this.positions.entries()),
      populations: Object.fromEntries(this.populations.entries()),
      speciesTraits: Object.fromEntries(this.speciesTraits.entries()),
      civStats: Object.fromEntries(this.civStats.entries()),
      resources: Object.fromEntries(this.resources.entries()),
      climate: Object.fromEntries(this.climate.entries()),
    };
  }

  restore(snap: WorldSnapshot): void {
    this.nextId = snap.nextId;
    this.alive.clear();
    for (const id of snap.entities) this.alive.add(Number(id));
    const restoreStore = <T>(store: ComponentStore<T>, data: Record<string, T>) => {
      for (const [k] of [...store.entries()]) store.delete(Number(k));
      for (const [k, v] of Object.entries(data)) store.set(Number(k), v);
    };
    restoreStore(this.positions, snap.positions);
    restoreStore(this.populations, snap.populations);
    restoreStore(this.speciesTraits, snap.speciesTraits);
    restoreStore(this.civStats, snap.civStats);
    restoreStore(this.resources, snap.resources);
    restoreStore(this.climate, snap.climate);
  }
}

export interface WorldSnapshot {
  nextId: number;
  entities: EntityId[];
  positions: Record<string, Position>;
  populations: Record<string, Population>;
  speciesTraits: Record<string, SpeciesTraitsComponent>;
  civStats: Record<string, CivStats>;
  resources: Record<string, ResourceStock>;
  climate: Record<string, ClimateCell>;
}
