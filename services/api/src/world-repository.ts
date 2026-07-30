import type {
  AnalyzedContribution,
  CausalLink,
  ScenarioOutcome,
  TimelineSnapshot,
  WorldEvent,
  WorldOverview,
  WorldState,
} from "@living-planet/shared-types";
import {
  deterministicId,
  generateWorld,
  introduceContribution,
  projectContributionScenarios,
  simulateTick,
  stateChecksum,
} from "@living-planet/simulation-models";
import postgres, { type Sql } from "postgres";

function toJson(value: unknown): never {
  return JSON.parse(JSON.stringify(value)) as never;
}

export interface DeltaResult {
  state: WorldState;
  events: WorldEvent[];
  causalLinks: CausalLink[];
  changedRegionIds: string[];
  contributionId?: string;
}

export interface WorldRepository {
  readonly sandbox: boolean;
  initialize(): Promise<void>;
  overview(): Promise<WorldOverview>;
  tick(): Promise<DeltaResult>;
  pause(paused: boolean): Promise<WorldState>;
  contribute(
    analysis: AnalyzedContribution,
    regionId: string,
    ownerUserId: string,
    expectedVersion: number,
  ): Promise<DeltaResult>;
  project(
    analysis: AnalyzedContribution,
    regionId: string,
  ): Promise<ScenarioOutcome[]>;
  snapshot(tick: number): Promise<TimelineSnapshot | undefined>;
  rollback(tick: number): Promise<WorldState>;
}

function createSnapshot(state: WorldState): TimelineSnapshot {
  return {
    id: deterministicId(state.seed, "snapshot", state.tick),
    planetId: state.planetId,
    tick: state.tick,
    year: state.year,
    eventSequence: state.lastEventSequence,
    state: structuredClone(state),
    checksum: stateChecksum(state),
    createdAt: new Date(Date.UTC(2000, 0, 1) + state.tick * 10_000).toISOString(),
  };
}

export class InMemoryWorldRepository implements WorldRepository {
  readonly sandbox: boolean = true;
  protected state!: WorldState;
  protected events: WorldEvent[] = [];
  protected causalLinks: CausalLink[] = [];
  protected snapshots = new Map<number, TimelineSnapshot>();

  constructor(protected readonly seed = "azura-prime-7") {}

  async initialize(): Promise<void> {
    if (this.state) return;
    this.state = generateWorld(this.seed);
    this.snapshots.set(0, createSnapshot(this.state));
    for (let index = 0; index < 5; index += 1) {
      const result = simulateTick(this.state, this.events);
      this.accept(result);
      this.snapshots.set(this.state.tick, createSnapshot(this.state));
    }
  }

  protected accept(result: DeltaResult): void {
    this.state = result.state;
    this.events.push(...result.events);
    this.causalLinks.push(...result.causalLinks);
  }

  async overview(): Promise<WorldOverview> {
    return {
      planet: {
        id: this.state.planetId,
        nameAr: "أزورا",
        nameEn: "Azura",
        seed: this.state.seed,
        version: this.state.version,
        year: this.state.year,
        tick: this.state.tick,
        tickYears: this.state.tickYears,
        paused: this.state.paused,
      },
      climate: this.state.climate,
      regions: this.state.regions,
      civilizations: this.state.civilizations,
      events: this.events
        .filter((event) => event.type !== "SIMULATION_TICK_COMPLETED")
        .slice(-80)
        .reverse(),
      causalLinks: this.causalLinks.slice(-200),
      sandbox: this.sandbox,
    };
  }

  async tick(): Promise<DeltaResult> {
    const result = simulateTick(this.state, this.events);
    this.accept(result);
    if (this.state.tick % 5 === 0) this.snapshots.set(this.state.tick, createSnapshot(this.state));
    return result;
  }

  async pause(paused: boolean): Promise<WorldState> {
    this.state = { ...this.state, paused, version: this.state.version + 1 };
    return structuredClone(this.state);
  }

  async contribute(
    analysis: AnalyzedContribution,
    regionId: string,
    ownerUserId: string,
    expectedVersion: number,
  ): Promise<DeltaResult> {
    if (expectedVersion !== this.state.version) {
      throw new Error("WORLD_VERSION_CONFLICT");
    }
    const result = introduceContribution(this.state, analysis, regionId, ownerUserId);
    this.accept(result);
    this.snapshots.set(this.state.tick, createSnapshot(this.state));
    return result;
  }

  async project(
    analysis: AnalyzedContribution,
    regionId: string,
  ): Promise<ScenarioOutcome[]> {
    return projectContributionScenarios(this.state, analysis, regionId);
  }

  async snapshot(tick: number): Promise<TimelineSnapshot | undefined> {
    return this.snapshots.get(tick);
  }

  async rollback(tick: number): Promise<WorldState> {
    const snapshot = this.snapshots.get(tick);
    if (!snapshot) throw new Error("SNAPSHOT_NOT_FOUND");
    this.state = structuredClone(snapshot.state);
    this.events = this.events.filter((event) => event.sequence <= snapshot.eventSequence);
    this.causalLinks = this.causalLinks.filter((link) =>
      this.events.some((event) => event.id === link.toEventId),
    );
    return structuredClone(this.state);
  }
}

export class PostgresWorldRepository extends InMemoryWorldRepository {
  override readonly sandbox = false;

  constructor(
    private readonly sql: Sql,
    seed: string,
  ) {
    super(seed);
  }

  override async initialize(): Promise<void> {
    const [planet] = await this.sql<
      { state: WorldState }[]
    >`select state from planets where seed = ${this.seed} limit 1`;
    if (!planet) {
      await super.initialize();
      await this.persist(true, {
        state: this.state,
        events: this.events,
        causalLinks: this.causalLinks,
        changedRegionIds: [],
      });
      return;
    }

    this.state = planet.state;
    const storedEvents = await this.sql<
      { payload: WorldEvent }[]
    >`select payload from world_events where planet_id = ${this.state.planetId} order by sequence`;
    this.events = storedEvents.map((row) => row.payload);
    const storedLinks = await this.sql<
      { payload: CausalLink }[]
    >`select payload from causal_links where planet_id = ${this.state.planetId}`;
    this.causalLinks = storedLinks.map((row) => row.payload);
    const storedSnapshots = await this.sql<
      { tick: number; payload: TimelineSnapshot }[]
    >`select tick, payload from timeline_snapshots where planet_id = ${this.state.planetId}`;
    this.snapshots = new Map(storedSnapshots.map((row) => [row.tick, row.payload]));
  }

  private async persist(initial = false, result?: DeltaResult): Promise<void> {
    await this.sql.begin(async (transaction) => {
      if (initial) {
        await transaction`
          insert into planets (id, name_ar, name_en, seed, version, state)
          values (${this.state.planetId}, 'أزورا', 'Azura', ${this.seed}, ${this.state.version}, ${transaction.json(toJson(this.state))})
          on conflict (id) do nothing
        `;
      } else {
        const updated = await transaction`
          update planets
          set version = ${this.state.version}, state = ${transaction.json(toJson(this.state))}, updated_at = now()
          where id = ${this.state.planetId}
        `;
        if (updated.count !== 1) throw new Error("WORLD_PERSISTENCE_CONFLICT");
      }
      if (result?.events.length) {
        for (const event of result.events) {
          await transaction`
            insert into world_events
              (id, planet_id, sequence, event_type, simulation_year, tick, region_id, contribution_id, payload)
            values
              (${event.id}, ${this.state.planetId}, ${event.sequence}, ${event.type}, ${event.simulationYear},
               ${event.tick}, ${event.regionId ?? null}, ${event.contributionId ?? null}, ${transaction.json(toJson(event))})
            on conflict (id) do nothing
          `;
        }
      }
      if (result?.causalLinks.length) {
        for (const link of result.causalLinks) {
          await transaction`
            insert into causal_links (id, planet_id, from_event_id, to_event_id, relation, strength, payload)
            values (${link.id}, ${this.state.planetId}, ${link.fromEventId}, ${link.toEventId},
                    ${link.relation}, ${link.strength}, ${transaction.json(toJson(link))})
            on conflict (id) do nothing
          `;
        }
      }
      const snapshots = initial
        ? [...this.snapshots.values()]
        : [this.snapshots.get(this.state.tick)].filter(
            (snapshot): snapshot is TimelineSnapshot => Boolean(snapshot),
          );
      for (const snapshot of snapshots) {
        await transaction`
          insert into timeline_snapshots (id, planet_id, tick, simulation_year, event_sequence, checksum, payload)
          values (${snapshot.id}, ${this.state.planetId}, ${snapshot.tick}, ${snapshot.year},
                  ${snapshot.eventSequence}, ${snapshot.checksum}, ${transaction.json(toJson(snapshot))})
          on conflict (planet_id, tick) do update set payload = excluded.payload, checksum = excluded.checksum
        `;
      }
    });
  }

  override async tick(): Promise<DeltaResult> {
    const result = await super.tick();
    await this.persist(false, result);
    return result;
  }

  override async pause(paused: boolean): Promise<WorldState> {
    const state = await super.pause(paused);
    await this.persist();
    return state;
  }

  override async contribute(
    analysis: AnalyzedContribution,
    regionId: string,
    ownerUserId: string,
    expectedVersion: number,
  ): Promise<DeltaResult> {
    const result = await super.contribute(analysis, regionId, ownerUserId, expectedVersion);
    await this.sql`
      insert into user_contributions
        (id, planet_id, user_id, region_id, category, name, status, structured_traits, world_version)
      values
        (${result.contributionId!}, ${this.state.planetId}, ${ownerUserId}, ${regionId},
         ${analysis.category}, ${analysis.name}, 'active', ${this.sql.json(analysis)}, ${this.state.version})
    `;
    await this.persist(false, result);
    return result;
  }

  override async rollback(tick: number): Promise<WorldState> {
    const snapshot = this.snapshots.get(tick);
    if (!snapshot) throw new Error("SNAPSHOT_NOT_FOUND");
    const state = await super.rollback(tick);
    await this.sql.begin(async (transaction) => {
      await transaction`
        delete from notifications
        where event_id in (
          select id from world_events
          where planet_id = ${this.state.planetId}
            and sequence > ${snapshot.eventSequence}
        )
      `;
      await transaction`
        delete from causal_links
        where planet_id = ${this.state.planetId}
          and (
            from_event_id in (
              select id from world_events
              where planet_id = ${this.state.planetId}
                and sequence > ${snapshot.eventSequence}
            )
            or to_event_id in (
              select id from world_events
              where planet_id = ${this.state.planetId}
                and sequence > ${snapshot.eventSequence}
            )
          )
      `;
      await transaction`
        delete from world_events
        where planet_id = ${this.state.planetId}
          and sequence > ${snapshot.eventSequence}
      `;
      await transaction`
        delete from timeline_snapshots
        where planet_id = ${this.state.planetId}
          and tick > ${snapshot.tick}
      `;
      await transaction`
        delete from user_contributions
        where planet_id = ${this.state.planetId}
          and world_version > ${snapshot.state.version}
      `;
    });
    await this.persist();
    return state;
  }
}

export function createWorldRepository(): WorldRepository {
  const databaseUrl = process.env.DATABASE_URL;
  const mode = process.env.WORLD_STORE ?? (databaseUrl ? "postgres" : "memory");
  if (mode === "postgres") {
    if (!databaseUrl) throw new Error("DATABASE_URL is required when WORLD_STORE=postgres");
    return new PostgresWorldRepository(
      postgres(databaseUrl, { max: 10, prepare: true }),
      process.env.WORLD_SEED ?? "azura-prime-7",
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("The in-memory sandbox store is disabled in production");
  }
  return new InMemoryWorldRepository(process.env.WORLD_SEED ?? "azura-prime-7");
}
