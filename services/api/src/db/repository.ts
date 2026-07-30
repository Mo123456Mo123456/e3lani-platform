import { randomUUID } from "node:crypto";
import {
  createInitialWorld,
  deserializeWorldState,
  generateWorld,
  serializeWorldState,
  type SimEvent,
  type WorldState,
} from "@planet-born/simulation-models";
import type {
  Locale,
  StructuredContribution,
  UserRole,
} from "@planet-born/shared-types";
import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.js";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  locale: Locale;
  displayName: string;
  level: number;
  xp: number;
  refreshTokenHash: string | null;
  refreshExpiresAt: Date | null;
  disabled: boolean;
  createdAt: Date;
};

export type PlanetRecord = {
  id: string;
  name: string;
  nameEn?: string;
  seed: string;
  status: "running" | "paused" | "rollback";
  currentTick: number;
  currentYear: number;
  tickUnit: "day" | "month" | "year" | "decade";
};

export type RegionRecord = {
  id: string;
  planetId: string;
  cellIndex: number;
  name: string;
  nameEn?: string;
  biome: string;
  lat: number;
  lon: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  population: number;
  pollution: number;
};

export type ContributionRecord = {
  id: string;
  userId: string;
  planetId: string;
  category: string;
  structured: StructuredContribution;
  location: { lat: number; lon: number };
  effects: Record<string, unknown>;
  createdAt: Date;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
};

type MemoryData = {
  users: Map<string, UserRecord>;
  planets: Map<string, PlanetRecord>;
  regions: Map<string, RegionRecord[]>;
  events: Map<string, SimEvent[]>;
  contributions: ContributionRecord[];
  notifications: NotificationRecord[];
  snapshots: Map<string, Array<{ id: string; tick: number; state: string; createdAt: Date }>>;
};

const createMemoryData = (): MemoryData => ({
  users: new Map(),
  planets: new Map(),
  regions: new Map(),
  events: new Map(),
  contributions: [],
  notifications: [],
  snapshots: new Map(),
});

export class Repository {
  readonly memoryMode: boolean;
  readonly worldCache = new Map<string, WorldState>();
  private readonly memory = createMemoryData();
  private readonly client?: Sql;
  private readonly db?: PostgresJsDatabase<typeof schema>;

  constructor(databaseUrl = process.env.DATABASE_URL) {
    this.memoryMode = !databaseUrl;
    if (databaseUrl) {
      this.client = postgres(databaseUrl, { max: 10 });
      this.db = drizzle(this.client, { schema });
    }
  }

  async close(): Promise<void> {
    await this.client?.end();
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    locale: Locale;
    role?: UserRole;
  }): Promise<UserRecord> {
    const email = input.email.toLowerCase();
    if (this.memoryMode) {
      if ([...this.memory.users.values()].some((user) => user.email === email)) {
        throw new Error("EMAIL_EXISTS");
      }
      const user: UserRecord = {
        id: randomUUID(),
        email,
        passwordHash: input.passwordHash,
        role: input.role ?? "registered",
        locale: input.locale,
        displayName: input.displayName,
        level: 0,
        xp: 0,
        refreshTokenHash: null,
        refreshExpiresAt: null,
        disabled: false,
        createdAt: new Date(),
      };
      this.memory.users.set(user.id, user);
      return user;
    }

    const [inserted] = await this.db!
      .insert(schema.users)
      .values({
        email,
        passwordHash: input.passwordHash,
        role: input.role ?? "registered",
        locale: input.locale,
      })
      .returning();
    if (!inserted) throw new Error("USER_CREATE_FAILED");
    const [profile] = await this.db!
      .insert(schema.profiles)
      .values({ userId: inserted.id, displayName: input.displayName })
      .returning();
    if (!profile) throw new Error("PROFILE_CREATE_FAILED");
    return this.toUser(inserted, profile);
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    if (this.memoryMode) {
      return [...this.memory.users.values()].find(
        (user) => user.email === email.toLowerCase(),
      );
    }
    const [row] = await this.db!
      .select({ user: schema.users, profile: schema.profiles })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    return row ? this.toUser(row.user, row.profile) : undefined;
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    if (this.memoryMode) return this.memory.users.get(id);
    const [row] = await this.db!
      .select({ user: schema.users, profile: schema.profiles })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.users.id, id))
      .limit(1);
    return row ? this.toUser(row.user, row.profile) : undefined;
  }

  async setRefreshToken(
    id: string,
    hash: string | null,
    expiresAt: Date | null,
  ): Promise<void> {
    if (this.memoryMode) {
      const user = this.memory.users.get(id);
      if (user) {
        user.refreshTokenHash = hash;
        user.refreshExpiresAt = expiresAt;
      }
      return;
    }
    await this.db!
      .update(schema.users)
      .set({ refreshTokenHash: hash, refreshExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(schema.users.id, id));
  }

  async listUsers(): Promise<Array<Omit<UserRecord, "passwordHash" | "refreshTokenHash">>> {
    if (this.memoryMode) {
      return [...this.memory.users.values()].map(
        ({ passwordHash: _password, refreshTokenHash: _refresh, ...user }) => user,
      );
    }
    const rows = await this.db!
      .select({ user: schema.users, profile: schema.profiles })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id));
    return rows.map(({ user, profile }) => {
      const { passwordHash: _password, refreshTokenHash: _refresh, ...publicUser } =
        this.toUser(user, profile);
      return publicUser;
    });
  }

  async createPlanet(input: {
    name: string;
    nameEn?: string;
    seed: string;
    state: WorldState;
    ownerId?: string;
  }): Promise<PlanetRecord> {
    const id = randomUUID();
    const planet: PlanetRecord = {
      id,
      name: input.name,
      nameEn: input.nameEn,
      seed: input.seed,
      status: "running",
      currentTick: input.state.tick,
      currentYear: input.state.year,
      tickUnit: input.state.tickUnit,
    };
    const generated = generateWorld(input.seed, input.state.world.width, input.state.world.height);
    const regions = generated.cells.map<RegionRecord>((cell, index) => ({
      id: randomUUID(),
      planetId: id,
      cellIndex: index,
      name: `المنطقة ${index + 1}`,
      nameEn: `Region ${index + 1}`,
      biome: cell.biome,
      lat: cell.lat,
      lon: cell.lon,
      elevation: cell.height,
      temperature: cell.temperature,
      moisture: cell.moisture,
      fertility: cell.fertility,
      population: 0,
      pollution: input.state.climate[index]?.pollution ?? 0,
    }));
    this.worldCache.set(id, input.state);

    if (this.memoryMode) {
      this.memory.planets.set(id, planet);
      this.memory.regions.set(id, regions);
      this.memory.events.set(id, [...input.state.events]);
      this.memory.snapshots.set(id, [
        { id: randomUUID(), tick: input.state.tick, state: serializeWorldState(input.state), createdAt: new Date() },
      ]);
      return planet;
    }

    await this.db!.transaction(async (tx) => {
      await tx.insert(schema.planets).values({
        id,
        ownerId: input.ownerId,
        name: input.name,
        nameEn: input.nameEn,
        seed: input.seed,
        currentTick: input.state.tick,
        currentYear: input.state.year,
        tickUnit: input.state.tickUnit,
      });
      for (let offset = 0; offset < regions.length; offset += 250) {
        await tx.insert(schema.planetRegions).values(
          regions.slice(offset, offset + 250).map((region) => ({
            ...region,
            metadata: { isOcean: region.biome === "ocean" },
          })),
        );
      }
      await tx.insert(schema.timelineSnapshots).values({
        planetId: id,
        tick: input.state.tick,
        state: JSON.parse(serializeWorldState(input.state)),
        reason: "genesis",
      });
      await tx.insert(schema.worldEvents).values(
        input.state.events.map((event) => this.eventValues(id, event)),
      );
    });
    return planet;
  }

  async listPlanets(): Promise<PlanetRecord[]> {
    if (this.memoryMode) return [...this.memory.planets.values()];
    const rows = await this.db!.select().from(schema.planets);
    return rows.map((row) => this.toPlanet(row));
  }

  async getPlanet(id: string): Promise<PlanetRecord | undefined> {
    if (this.memoryMode) return this.memory.planets.get(id);
    const [row] = await this.db!
      .select()
      .from(schema.planets)
      .where(eq(schema.planets.id, id))
      .limit(1);
    return row ? this.toPlanet(row) : undefined;
  }

  async setPlanetStatus(
    id: string,
    status: PlanetRecord["status"],
  ): Promise<PlanetRecord | undefined> {
    if (this.memoryMode) {
      const planet = this.memory.planets.get(id);
      if (planet) planet.status = status;
      return planet;
    }
    const [row] = await this.db!
      .update(schema.planets)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.planets.id, id))
      .returning();
    return row ? this.toPlanet(row) : undefined;
  }

  async getRegions(planetId: string): Promise<RegionRecord[]> {
    if (this.memoryMode) return this.memory.regions.get(planetId) ?? [];
    const rows = await this.db!
      .select()
      .from(schema.planetRegions)
      .where(eq(schema.planetRegions.planetId, planetId));
    return rows.map((row) => ({
      id: row.id,
      planetId: row.planetId,
      cellIndex: row.cellIndex,
      name: row.name,
      ...(row.nameEn ? { nameEn: row.nameEn } : {}),
      biome: row.biome,
      lat: row.lat,
      lon: row.lon,
      elevation: row.elevation,
      temperature: row.temperature,
      moisture: row.moisture,
      fertility: row.fertility,
      population: row.population,
      pollution: row.pollution,
    }));
  }

  async getEvents(planetId: string): Promise<SimEvent[]> {
    if (this.memoryMode) return this.memory.events.get(planetId) ?? [];
    const rows = await this.db!
      .select()
      .from(schema.worldEvents)
      .where(eq(schema.worldEvents.planetId, planetId))
      .orderBy(schema.worldEvents.tick, schema.worldEvents.createdAt);
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      ...(row.titleEn ? { titleEn: row.titleEn } : {}),
      description: row.description,
      tick: row.tick,
      simYear: row.simYear,
      importance: row.importance,
      causeIds: row.causeIds,
      ...(row.location ? { location: row.location } : {}),
      ...(row.contributionId ? { contributionId: row.contributionId } : {}),
      ...(row.userId ? { userId: row.userId } : {}),
      directEffects: row.effects,
      confidence: row.confidence,
    }));
  }

  async getWorldState(planetId: string): Promise<WorldState | undefined> {
    const cached = this.worldCache.get(planetId);
    if (cached) return cached;
    if (this.memoryMode) {
      const snapshot = this.memory.snapshots.get(planetId)?.at(-1);
      if (!snapshot) return undefined;
      const state = deserializeWorldState(snapshot.state);
      this.worldCache.set(planetId, state);
      return state;
    }
    const [snapshot] = await this.db!
      .select()
      .from(schema.timelineSnapshots)
      .where(eq(schema.timelineSnapshots.planetId, planetId))
      .orderBy(desc(schema.timelineSnapshots.tick))
      .limit(1);
    if (!snapshot) return undefined;
    const state = deserializeWorldState(JSON.stringify(snapshot.state));
    this.worldCache.set(planetId, state);
    return state;
  }

  async saveWorldState(
    planetId: string,
    state: WorldState,
    options: { snapshot?: boolean; reason?: string } = {},
  ): Promise<void> {
    const oldEventIds = new Set(
      (this.memoryMode
        ? this.memory.events.get(planetId) ?? []
        : await this.getEvents(planetId)
      ).map((event) => event.id),
    );
    const newEvents = state.events.filter((event) => !oldEventIds.has(event.id));
    this.worldCache.set(planetId, state);

    if (this.memoryMode) {
      const planet = this.memory.planets.get(planetId);
      if (planet) {
        planet.currentTick = state.tick;
        planet.currentYear = state.year;
      }
      this.memory.events.set(planetId, [...state.events]);
      if (options.snapshot) {
        const list = this.memory.snapshots.get(planetId) ?? [];
        list.push({
          id: randomUUID(),
          tick: state.tick,
          state: serializeWorldState(state),
          createdAt: new Date(),
        });
        this.memory.snapshots.set(planetId, list);
      }
      return;
    }

    await this.db!.transaction(async (tx) => {
      await tx
        .update(schema.planets)
        .set({ currentTick: state.tick, currentYear: state.year, updatedAt: new Date() })
        .where(eq(schema.planets.id, planetId));
      if (newEvents.length) {
        await tx
          .insert(schema.worldEvents)
          .values(newEvents.map((event) => this.eventValues(planetId, event)))
          .onConflictDoNothing();
      }
      if (options.snapshot) {
        await tx
          .insert(schema.timelineSnapshots)
          .values({
            planetId,
            tick: state.tick,
            state: JSON.parse(serializeWorldState(state)),
            reason: options.reason,
          })
          .onConflictDoNothing();
      }
    });
  }

  async createContribution(input: Omit<ContributionRecord, "createdAt">): Promise<ContributionRecord> {
    const contribution = { ...input, createdAt: new Date() };
    if (this.memoryMode) {
      this.memory.contributions.push(contribution);
      return contribution;
    }
    const [row] = await this.db!
      .insert(schema.userContributions)
      .values({
        id: input.id,
        userId: input.userId,
        planetId: input.planetId,
        category: input.category,
        structured: input.structured,
        location: input.location,
        effects: input.effects,
      })
      .returning();
    if (!row) throw new Error("CONTRIBUTION_CREATE_FAILED");
    return {
      id: row.id,
      userId: row.userId,
      planetId: row.planetId,
      category: row.category,
      structured: row.structured as StructuredContribution,
      location: row.location,
      effects: row.effects,
      createdAt: row.createdAt,
    };
  }

  async listContributions(userId: string): Promise<ContributionRecord[]> {
    if (this.memoryMode) {
      return this.memory.contributions.filter((item) => item.userId === userId);
    }
    const rows = await this.db!
      .select()
      .from(schema.userContributions)
      .where(eq(schema.userContributions.userId, userId))
      .orderBy(desc(schema.userContributions.createdAt));
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      planetId: row.planetId,
      category: row.category,
      structured: row.structured as StructuredContribution,
      location: row.location,
      effects: row.effects,
      createdAt: row.createdAt,
    }));
  }

  async listNotifications(userId: string): Promise<NotificationRecord[]> {
    if (this.memoryMode) {
      return this.memory.notifications.filter((item) => item.userId === userId);
    }
    return this.db!
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt));
  }

  async listSnapshots(planetId: string): Promise<Array<{ id: string; tick: number; createdAt: Date }>> {
    if (this.memoryMode) {
      return (this.memory.snapshots.get(planetId) ?? []).map(({ state: _state, ...item }) => item);
    }
    return this.db!
      .select({
        id: schema.timelineSnapshots.id,
        tick: schema.timelineSnapshots.tick,
        createdAt: schema.timelineSnapshots.createdAt,
      })
      .from(schema.timelineSnapshots)
      .where(eq(schema.timelineSnapshots.planetId, planetId))
      .orderBy(desc(schema.timelineSnapshots.tick));
  }

  async seed(input: {
    adminPasswordHash: string;
    explorerPasswordHash: string;
  }): Promise<{ admin: UserRecord; explorer: UserRecord; planet: PlanetRecord }> {
    const existingAdmin = await this.findUserByEmail("admin@planet.born");
    const admin =
      existingAdmin ??
      (await this.createUser({
        email: "admin@planet.born",
        passwordHash: input.adminPasswordHash,
        displayName: "مدير الكوكب",
        locale: "ar",
        role: "super_admin",
      }));
    const existingExplorer = await this.findUserByEmail("explorer@planet.born");
    const explorer =
      existingExplorer ??
      (await this.createUser({
        email: "explorer@planet.born",
        passwordHash: input.explorerPasswordHash,
        displayName: "المستكشف",
        locale: "ar",
        role: "explorer",
      }));
    const existingPlanet = (await this.listPlanets()).find(
      (planet) => planet.seed === "planet-born-genesis-v1",
    );
    const planet =
      existingPlanet ??
      (await this.createPlanet({
        name: "كوكب البداية",
        nameEn: "Genesis",
        seed: "planet-born-genesis-v1",
        ownerId: admin.id,
        state: createInitialWorld("planet-born-genesis-v1"),
      }));
    return { admin, explorer, planet };
  }

  async eventsByIds(planetId: string, ids: string[]): Promise<SimEvent[]> {
    if (this.memoryMode) {
      return (this.memory.events.get(planetId) ?? []).filter((event) => ids.includes(event.id));
    }
    if (!ids.length) return [];
    const rows = await this.db!
      .select()
      .from(schema.worldEvents)
      .where(
        and(
          eq(schema.worldEvents.planetId, planetId),
          inArray(schema.worldEvents.id, ids),
        ),
      );
    const all = await this.getEvents(planetId);
    const found = new Set(rows.map((row) => row.id));
    return all.filter((event) => found.has(event.id));
  }

  private toUser(
    user: typeof schema.users.$inferSelect,
    profile: typeof schema.profiles.$inferSelect,
  ): UserRecord {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role as UserRole,
      locale: user.locale as Locale,
      displayName: profile.displayName,
      level: profile.level,
      xp: profile.xp,
      refreshTokenHash: user.refreshTokenHash,
      refreshExpiresAt: user.refreshExpiresAt,
      disabled: user.disabled,
      createdAt: user.createdAt,
    };
  }

  private toPlanet(row: typeof schema.planets.$inferSelect): PlanetRecord {
    return {
      id: row.id,
      name: row.name,
      ...(row.nameEn ? { nameEn: row.nameEn } : {}),
      seed: row.seed,
      status: row.status as PlanetRecord["status"],
      currentTick: row.currentTick,
      currentYear: row.currentYear,
      tickUnit: row.tickUnit as PlanetRecord["tickUnit"],
    };
  }

  private eventValues(planetId: string, event: SimEvent) {
    return {
      id: event.id,
      planetId,
      contributionId: event.contributionId,
      userId: event.userId,
      type: String(event.type),
      title: event.title,
      titleEn: event.titleEn,
      description: event.description,
      tick: event.tick,
      simYear: event.simYear,
      importance: event.importance,
      location: event.location,
      causeIds: event.causeIds,
      effects: event.directEffects,
      confidence: event.confidence,
    };
  }
}
