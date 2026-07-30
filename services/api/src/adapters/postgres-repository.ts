import { createHash } from "node:crypto";
import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import type {
  AuthSession,
  CommitResult,
  GroundingContext,
  PlanetSummary,
  Role,
  TimelineSnapshot,
  UserIdentity,
  WorldEvent,
  WorldRegion,
} from "../domain/contracts.js";
import { roleSchema } from "../domain/contracts.js";
import * as schema from "../db/schema.js";
import {
  aiRequests,
  auditLogs,
  authSessions,
  biomes,
  causalLinks,
  cities,
  civilizations,
  climateCells,
  cultures,
  languages,
  moderationResults,
  notifications,
  planetRegions,
  planets,
  plants,
  profiles,
  resources,
  roles,
  simulationTicks,
  species,
  technologies,
  timelineSnapshots,
  tradeRoutes,
  userContributions,
  userRoles,
  users,
  worldEvents,
} from "../db/schema.js";
import type {
  AiAssessmentRecord,
  CommitContributionInput,
  CreateAccountInput,
  Page,
  PageOptions,
  UserWithPassword,
  WorldRepository,
} from "./repository.js";

type Database = PostgresJsDatabase<typeof schema>;

function pageOffset(cursor?: string): number {
  const parsed = cursor ? Number.parseInt(cursor, 10) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function makePage<T>(rows: T[], options: PageOptions, offset: number): Page<T> {
  const hasMore = rows.length > options.limit;
  return {
    items: rows.slice(0, options.limit),
    nextCursor: hasMore ? String(offset + options.limit) : undefined,
  };
}

function toEvent(row: typeof worldEvents.$inferSelect): WorldEvent {
  return {
    id: row.id,
    planetId: row.planetId,
    tick: row.tick,
    title: row.title,
    summary: row.summary,
    category: row.category,
    magnitude: row.magnitude,
    causedByContributionId: row.contributionId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSnapshot(row: typeof timelineSnapshots.$inferSelect): TimelineSnapshot {
  return {
    id: row.id,
    planetId: row.planetId,
    tick: row.tick,
    reason: row.reason,
    state: row.state as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PostgresWorldRepository implements WorldRepository {
  readonly kind = "postgresql" as const;
  readonly db: Database;
  private readonly client: Sql;

  constructor(databaseUrl: string) {
    this.client = postgres(databaseUrl, {
      max: 12,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    this.db = drizzle(this.client, { schema });
  }

  async health() {
    const started = performance.now();
    await this.db.execute(sql`select 1 as ok`);
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  }

  async close() {
    await this.client.end({ timeout: 5 });
  }

  async createAccount(input: CreateAccountInput): Promise<UserIdentity> {
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email: input.email, passwordHash: input.passwordHash })
        .returning();
      if (!user) throw new Error("ACCOUNT_CREATE_FAILED");
      const [profile] = await tx
        .insert(profiles)
        .values({ userId: user.id, displayName: input.displayName })
        .returning();
      const [role] = await tx.select().from(roles).where(eq(roles.name, input.role)).limit(1);
      if (!role) throw new Error("ROLES_NOT_MIGRATED");
      await tx.insert(userRoles).values({ userId: user.id, roleId: role.id });
      return {
        id: user.id,
        email: user.email,
        displayName: profile!.displayName,
        roles: [input.role],
      };
    });
  }

  async findUserByEmail(email: string) {
    return this.findUser(and(eq(users.email, email), eq(users.status, "active")));
  }

  async findUserById(id: string) {
    const user = await this.findUser(and(eq(users.id, id), eq(users.status, "active")));
    if (!user) return undefined;
    const { passwordHash: _, ...identity } = user;
    return identity;
  }

  private async findUser(
    where: ReturnType<typeof and>,
  ): Promise<UserWithPassword | undefined> {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        displayName: profiles.displayName,
        role: roles.name,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .where(where);
    const first = rows[0];
    if (!first) return undefined;
    return {
      id: first.id,
      email: first.email,
      passwordHash: first.passwordHash,
      displayName: first.displayName,
      roles: rows
        .map((row) => row.role)
        .filter((role): role is Role => roleSchema.safeParse(role).success),
    };
  }

  async createSession(userId: string, expiresAt: Date): Promise<AuthSession> {
    const [session] = await this.db
      .insert(authSessions)
      .values({ userId, expiresAt })
      .returning();
    if (!session) throw new Error("SESSION_CREATE_FAILED");
    return { id: session.id, userId: session.userId, expiresAt: session.expiresAt.toISOString() };
  }

  async sessionIsActive(sessionId: string, userId: string) {
    const [session] = await this.db
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return Boolean(session);
  }

  async revokeSession(sessionId: string) {
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.id, sessionId));
  }

  async getDefaultPlanetId() {
    const [planet] = await this.db
      .select({ id: planets.id })
      .from(planets)
      .orderBy(planets.createdAt)
      .limit(1);
    if (!planet) throw new Error("NO_PLANET_SEEDED");
    return planet.id;
  }

  async getWorldSummary(planetId: string): Promise<PlanetSummary | undefined> {
    const [planet] = await this.db.select().from(planets).where(eq(planets.id, planetId)).limit(1);
    if (!planet) return undefined;
    const countRows = await Promise.all([
      this.db.select({ value: count() }).from(planetRegions).where(eq(planetRegions.planetId, planetId)),
      this.db.select({ value: count() }).from(civilizations).where(eq(civilizations.planetId, planetId)),
      this.db.select({ value: count() }).from(cities).where(eq(cities.planetId, planetId)),
      this.db.select({ value: count() }).from(resources).where(eq(resources.planetId, planetId)),
      this.db.select({ value: count() }).from(species).where(eq(species.planetId, planetId)),
      this.db.select({ value: count() }).from(plants).where(eq(plants.planetId, planetId)),
      this.db.select({ value: count() }).from(technologies).where(eq(technologies.planetId, planetId)),
    ]);
    const [
      regionCount,
      civilizationCount,
      cityCount,
      resourceCount,
      speciesCount,
      plantCount,
      technologyCount,
    ] = countRows.map((rows) => rows[0]?.value ?? 0);
    return {
      id: planet.id,
      name: planet.name,
      slug: planet.slug,
      currentTick: planet.currentTick,
      isPaused: planet.isPaused,
      stability: planet.stability,
      biodiversity: planet.biodiversity,
      averageTemperature: planet.averageTemperature,
      population: planet.population,
      counts: {
        regions: regionCount!,
        civilizations: civilizationCount!,
        cities: cityCount!,
        resources: resourceCount!,
        species: speciesCount!,
        plants: plantCount!,
        technologies: technologyCount!,
      },
    };
  }

  async listRegions(planetId: string, options: PageOptions): Promise<Page<WorldRegion>> {
    const offset = pageOffset(options.cursor);
    const rows = await this.db
      .select({
        id: planetRegions.id,
        planetId: planetRegions.planetId,
        name: planetRegions.name,
        biome: biomes.name,
        latitude: planetRegions.latitude,
        longitude: planetRegions.longitude,
        population: planetRegions.population,
        stability: planetRegions.stability,
      })
      .from(planetRegions)
      .leftJoin(biomes, eq(biomes.id, planetRegions.biomeId))
      .where(eq(planetRegions.planetId, planetId))
      .orderBy(planetRegions.name)
      .limit(options.limit + 1)
      .offset(offset);
    return makePage(
      rows.map((row) => ({ ...row, biome: row.biome ?? "unknown" })),
      options,
      offset,
    );
  }

  async listEvents(planetId: string, options: PageOptions): Promise<Page<WorldEvent>> {
    const offset = pageOffset(options.cursor);
    const rows = await this.db
      .select()
      .from(worldEvents)
      .where(and(eq(worldEvents.planetId, planetId), eq(worldEvents.isRetracted, false)))
      .orderBy(desc(worldEvents.tick), desc(worldEvents.createdAt))
      .limit(options.limit + 1)
      .offset(offset);
    return makePage(rows.map(toEvent), options, offset);
  }

  async listTimeline(planetId: string, options: PageOptions): Promise<Page<TimelineSnapshot>> {
    const offset = pageOffset(options.cursor);
    const rows = await this.db
      .select()
      .from(timelineSnapshots)
      .where(eq(timelineSnapshots.planetId, planetId))
      .orderBy(desc(timelineSnapshots.tick))
      .limit(options.limit + 1)
      .offset(offset);
    return makePage(rows.map(toSnapshot), options, offset);
  }

  async getGroundingContext(planetId: string): Promise<GroundingContext> {
    const summary = await this.getWorldSummary(planetId);
    if (!summary) throw new Error("PLANET_NOT_FOUND");
    const [regionRows, civilizationRows, eventRows] = await Promise.all([
      this.db.select({ id: planetRegions.id }).from(planetRegions).where(eq(planetRegions.planetId, planetId)),
      this.db.select({ id: civilizations.id }).from(civilizations).where(eq(civilizations.planetId, planetId)),
      this.db
        .select({ id: worldEvents.id })
        .from(worldEvents)
        .where(and(eq(worldEvents.planetId, planetId), eq(worldEvents.isRetracted, false)))
        .orderBy(desc(worldEvents.tick))
        .limit(20),
    ]);
    return {
      summary,
      regionIds: regionRows.map((row) => row.id),
      civilizationIds: civilizationRows.map((row) => row.id),
      recentEventIds: eventRows.map((row) => row.id),
    };
  }

  async recordAiAssessment(record: AiAssessmentRecord) {
    await this.db.transaction(async (tx) => {
      const [request] = await tx
        .insert(aiRequests)
        .values({
          userId: record.userId,
          planetId: record.planetId,
          provider: record.provider,
          model: record.model,
          promptHash: createHash("sha256").update(record.proposal).digest("hex"),
          status: !record.moderation.allowed ? "rejected" : record.error ? "failed" : "completed",
          response: record.analysis,
          latencyMs: record.latencyMs,
          error: record.error,
        })
        .returning({ id: aiRequests.id });
      await tx.insert(moderationResults).values({
        aiRequestId: request?.id,
        userId: record.userId,
        allowed: record.moderation.allowed,
        risk: record.moderation.risk,
        reasons: record.moderation.reasons,
      });
    });
  }

  async commitContribution(input: CommitContributionInput): Promise<CommitResult> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from planets where id = ${input.input.planetId} for update`,
      );
      const [existing] = await tx
        .select()
        .from(userContributions)
        .where(
          and(
            eq(userContributions.userId, input.userId),
            eq(userContributions.planetId, input.input.planetId),
            eq(userContributions.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing?.committedTick !== null && existing?.committedTick !== undefined) {
        const [events, snapshots] = await Promise.all([
          tx
            .select()
            .from(worldEvents)
            .where(eq(worldEvents.contributionId, existing.id)),
          tx
            .select()
            .from(timelineSnapshots)
            .where(
              and(
                eq(timelineSnapshots.planetId, existing.planetId),
                eq(timelineSnapshots.tick, existing.committedTick),
              ),
            )
            .limit(1),
        ]);
        return {
          contributionId: existing.id,
          tick: existing.committedTick,
          events: events.map(toEvent),
          snapshotId: snapshots[0]?.id ?? "",
          replayed: true,
        };
      }

      const [planet] = await tx
        .select()
        .from(planets)
        .where(eq(planets.id, input.input.planetId))
        .limit(1);
      if (!planet) throw new Error("PLANET_NOT_FOUND");
      if (planet.isPaused) throw new Error("SIMULATION_PAUSED");

      const tick = planet.currentTick + 1;
      let stability = planet.stability;
      let biodiversity = planet.biodiversity;
      let averageTemperature = planet.averageTemperature;
      let population = planet.population;
      for (const effect of input.analysis.effects) {
        if (effect.metric === "stability") stability = Math.max(0, Math.min(1, stability + effect.delta));
        if (effect.metric === "biodiversity") biodiversity = Math.max(0, Math.min(1, biodiversity + effect.delta));
        if (effect.metric === "temperature") averageTemperature += effect.delta * 4;
        if (effect.metric === "population") population = Math.max(0, Math.round(population * (1 + effect.delta)));
      }

      const [contribution] = await tx
        .insert(userContributions)
        .values({
          userId: input.userId,
          planetId: planet.id,
          proposal: input.input.proposal,
          status: "accepted",
          analysis: input.analysis,
          idempotencyKey: input.idempotencyKey,
          committedTick: tick,
        })
        .returning();
      if (!contribution) throw new Error("CONTRIBUTION_CREATE_FAILED");

      await tx.insert(simulationTicks).values({
        planetId: planet.id,
        tick,
        status: "committed",
        metrics: { stability, biodiversity, averageTemperature, population },
        completedAt: new Date(),
      });
      const magnitude = Math.min(
        1,
        input.analysis.effects.reduce((sum, effect) => sum + Math.abs(effect.delta), 0),
      );
      const [event] = await tx
        .insert(worldEvents)
        .values({
          planetId: planet.id,
          contributionId: contribution.id,
          tick,
          title: input.analysis.title,
          summary: input.analysis.summary,
          category: input.analysis.category,
          magnitude,
          payload: { effects: input.analysis.effects, warnings: input.analysis.warnings },
        })
        .returning();
      if (!event) throw new Error("EVENT_CREATE_FAILED");

      if (input.analysis.causalEventIds.length > 0) {
        await tx.insert(causalLinks).values(
          input.analysis.causalEventIds.map((sourceEventId) => ({
            planetId: planet.id,
            sourceEventId,
            targetEventId: event.id,
            relation: "influenced",
            strength: input.analysis.confidence,
          })),
        );
      }

      const state = {
        summary: {
          id: planet.id,
          name: planet.name,
          slug: planet.slug,
          currentTick: tick,
          isPaused: false,
          stability,
          biodiversity,
          averageTemperature,
          population,
        },
        contributionId: contribution.id,
        effects: input.analysis.effects,
      };
      const [snapshot] = await tx
        .insert(timelineSnapshots)
        .values({
          planetId: planet.id,
          tick,
          reason: "contribution_commit",
          state,
          checksum: createHash("sha256").update(JSON.stringify(state)).digest("hex"),
        })
        .returning();
      if (!snapshot) throw new Error("SNAPSHOT_CREATE_FAILED");

      await Promise.all([
        tx
          .update(planets)
          .set({
            currentTick: tick,
            stability,
            biodiversity,
            averageTemperature,
            population,
            updatedAt: new Date(),
          })
          .where(eq(planets.id, planet.id)),
        tx.insert(notifications).values({
          userId: input.userId,
          planetId: planet.id,
          type: "contribution_committed",
          title: "تم اعتماد مساهمتك",
          body: `أصبحت مساهمتك جزءاً من الزمن عند النبضة ${tick}.`,
          payload: { contributionId: contribution.id, eventId: event.id, tick },
        }),
      ]);

      return {
        contributionId: contribution.id,
        tick,
        events: [toEvent(event)],
        snapshotId: snapshot.id,
        replayed: false,
      };
    });
  }

  async setTickPaused(planetId: string, paused: boolean, actorId: string) {
    await this.db.transaction(async (tx) => {
      const [planet] = await tx
        .update(planets)
        .set({ isPaused: paused, updatedAt: new Date() })
        .where(eq(planets.id, planetId))
        .returning({ id: planets.id });
      if (!planet) throw new Error("PLANET_NOT_FOUND");
      await tx.insert(auditLogs).values({
        actorUserId: actorId,
        action: paused ? "simulation.pause" : "simulation.resume",
        entityType: "planet",
        entityId: planetId,
      });
    });
  }

  async rollbackToSnapshot(planetId: string, tick: number, actorId: string) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select id from planets where id = ${planetId} for update`);
      const [snapshot] = await tx
        .select()
        .from(timelineSnapshots)
        .where(and(eq(timelineSnapshots.planetId, planetId), eq(timelineSnapshots.tick, tick)))
        .limit(1);
      if (!snapshot) throw new Error("SNAPSHOT_NOT_FOUND");
      const state = snapshot.state as {
        summary?: {
          stability?: number;
          biodiversity?: number;
          averageTemperature?: number;
          population?: number;
        };
      };
      if (!state.summary) throw new Error("SNAPSHOT_STATE_INVALID");
      await Promise.all([
        tx
          .update(planets)
          .set({
            currentTick: tick,
            stability: state.summary.stability,
            biodiversity: state.summary.biodiversity,
            averageTemperature: state.summary.averageTemperature,
            population: state.summary.population,
            isPaused: true,
            updatedAt: new Date(),
          })
          .where(eq(planets.id, planetId)),
        tx
          .update(simulationTicks)
          .set({ status: "rolled_back" })
          .where(and(eq(simulationTicks.planetId, planetId), gt(simulationTicks.tick, tick))),
        tx
          .update(worldEvents)
          .set({ isRetracted: true })
          .where(and(eq(worldEvents.planetId, planetId), gt(worldEvents.tick, tick))),
        tx.insert(auditLogs).values({
          actorUserId: actorId,
          action: "timeline.rollback",
          entityType: "planet",
          entityId: planetId,
          metadata: { tick, snapshotId: snapshot.id },
        }),
      ]);
      return toSnapshot(snapshot);
    });
  }

  async seedDemoWorld(): Promise<PlanetSummary> {
    const [existing] = await this.db
      .select({ id: planets.id })
      .from(planets)
      .where(eq(planets.slug, "orion-newborn"))
      .limit(1);
    if (existing) return (await this.getWorldSummary(existing.id))!;

    const planetId = await this.db.transaction(async (tx) => {
      const [planet] = await tx
        .insert(planets)
        .values({
          name: "كوكب أوريون الوليد",
          slug: "orion-newborn",
          seed: 2_026_073,
          currentTick: 7,
          stability: 0.74,
          biodiversity: 0.86,
          averageTemperature: 18.4,
          population: 24_000_000,
          settings: { deterministic: true, language: "ar" },
        })
        .returning();
      if (!planet) throw new Error("SEED_PLANET_FAILED");

      const biomeRows = await tx
        .insert(biomes)
        .values(
          ["Crystal Forest", "Azure Steppe", "Ember Desert", "Polar Bloom"].map(
            (name, index) => ({
              planetId: planet.id,
              name,
              climateType: ["temperate", "continental", "arid", "polar"][index]!,
              carryingCapacity: 8_000_000 + index * 1_000_000,
              properties: { seedIndex: index },
            }),
          ),
        )
        .returning();
      const regionRows = await tx
        .insert(planetRegions)
        .values(
          biomeRows.map((biome, index) => ({
            planetId: planet.id,
            biomeId: biome.id,
            name: `إقليم ${index + 1}`,
            latitude: -55 + index * 35,
            longitude: -120 + index * 70,
            areaKm2: 1_200_000 + index * 110_000,
            population: 4_500_000 + index * 1_000_000,
            stability: 0.68 + index * 0.03,
            geography: { tectonicPlate: index, coastal: index % 2 === 0 },
          })),
        )
        .returning();
      await tx.insert(climateCells).values(
        Array.from({ length: 24 }, (_, index) => ({
          planetId: planet.id,
          regionId: regionRows[index % regionRows.length]!.id,
          gridX: index % 6,
          gridY: Math.floor(index / 6),
          temperature: 12 + (index % 9),
          precipitation: 200 + (index * 47) % 900,
          atmosphericCarbon: 310 + (index % 12),
          tick: 7,
        })),
      );

      const civilizationRows = await tx
        .insert(civilizations)
        .values(
          Array.from({ length: 12 }, (_, index) => ({
            planetId: planet.id,
            homeRegionId: regionRows[index % regionRows.length]!.id,
            name: `حضارة أوريون ${index + 1}`,
            government: ["council", "federation", "stewardship"][index % 3]!,
            population: 1_000_000 + index * 175_000,
            prosperity: 0.45 + (index % 5) * 0.08,
            stability: 0.55 + (index % 4) * 0.08,
            foundedTick: index % 4,
          })),
        )
        .returning();
      const cityRows = await tx
        .insert(cities)
        .values(
          Array.from({ length: 40 }, (_, index) => ({
            planetId: planet.id,
            civilizationId: civilizationRows[index % civilizationRows.length]!.id,
            regionId: regionRows[index % regionRows.length]!.id,
            name: `مدينة النور ${index + 1}`,
            population: 80_000 + index * 9_500,
            latitude: -58 + (index * 7) % 116,
            longitude: -170 + (index * 19) % 340,
            foundedTick: index % 7,
            infrastructure: { tier: 1 + (index % 4) },
          })),
        )
        .returning();

      await tx.insert(resources).values(
        Array.from({ length: 120 }, (_, index) => ({
          planetId: planet.id,
          regionId: regionRows[index % regionRows.length]!.id,
          name: `مورد ${index + 1}`,
          category: ["mineral", "energy", "organic", "water"][index % 4]!,
          quantity: 10_000 + index * 137,
          renewability: (index % 10) / 10,
          strategicValue: 0.2 + (index % 8) / 10,
        })),
      );
      await tx.insert(species).values(
        Array.from({ length: 300 }, (_, index) => ({
          planetId: planet.id,
          regionId: regionRows[index % regionRows.length]!.id,
          name: `نوع حيواني ${index + 1}`,
          taxonomy: ["aerial", "terrestrial", "aquatic"][index % 3]!,
          population: 5_000 + index * 113,
          conservationStatus: index % 13 === 0 ? "vulnerable" : "stable",
          traits: { nocturnal: index % 2 === 0, seedIndex: index },
        })),
      );
      await tx.insert(plants).values(
        Array.from({ length: 800 }, (_, index) => ({
          planetId: planet.id,
          regionId: regionRows[index % regionRows.length]!.id,
          biomeId: biomeRows[index % biomeRows.length]!.id,
          name: `نبات أوريوني ${index + 1}`,
          abundance: 0.2 + (index % 8) / 10,
          edible: index % 5 === 0,
          traits: { luminescent: index % 11 === 0, seedIndex: index },
        })),
      );
      await tx.insert(technologies).values(
        Array.from({ length: 50 }, (_, index) => ({
          planetId: planet.id,
          name: `تقنية ${index + 1}`,
          domain: ["energy", "agriculture", "medicine", "transport", "computing"][index % 5]!,
          level: 1 + (index % 5),
          discoveredTick: index % 8,
          effects: { efficiency: 0.01 * (1 + (index % 5)) },
        })),
      );
      const cultureRows = await tx
        .insert(cultures)
        .values(
          civilizationRows.map((civilization, index) => ({
            planetId: planet.id,
            civilizationId: civilization.id,
            name: `ثقافة ${index + 1}`,
            values: { cooperation: 0.5 + (index % 5) * 0.08 },
            influence: 0.4 + (index % 4) * 0.1,
          })),
        )
        .returning();
      await tx.insert(languages).values(
        cultureRows.map((culture, index) => ({
          planetId: planet.id,
          cultureId: culture.id,
          name: `لغة ${index + 1}`,
          speakers: 1_000_000 + index * 175_000,
          family: `عائلة ${1 + (index % 3)}`,
          writingSystem: "glyphic",
        })),
      );
      await tx.insert(tradeRoutes).values(
        Array.from({ length: 20 }, (_, index) => ({
          planetId: planet.id,
          originCityId: cityRows[index]!.id,
          destinationCityId: cityRows[index + 20]!.id,
          volume: 1_000 + index * 250,
          goods: [`resource-${index % 8}`],
          establishedTick: 3 + (index % 5),
        })),
      );

      const eventRows = await tx
        .insert(worldEvents)
        .values(
          Array.from({ length: 8 }, (_, index) => ({
            planetId: planet.id,
            tick: index,
            title: `مرحلة التكوين ${index + 1}`,
            summary: `حلقة سببية حتمية في تاريخ الكوكب، المرحلة ${index + 1}.`,
            category: index < 3 ? "ecology" : "society",
            magnitude: 0.1 + index * 0.02,
            payload: { seedIndex: index },
          })),
        )
        .returning();
      await tx.insert(causalLinks).values(
        eventRows.slice(1).map((event, index) => ({
          planetId: planet.id,
          sourceEventId: eventRows[index]!.id,
          targetEventId: event.id,
          relation: "caused",
          strength: 0.8,
        })),
      );
      const state = {
        summary: {
          id: planet.id,
          name: planet.name,
          slug: planet.slug,
          currentTick: 7,
          isPaused: false,
          stability: 0.74,
          biodiversity: 0.86,
          averageTemperature: 18.4,
          population: 24_000_000,
        },
        deterministicCounts: {
          civilizations: 12,
          cities: 40,
          resources: 120,
          species: 300,
          plants: 800,
          technologies: 50,
        },
      };
      await tx.insert(timelineSnapshots).values({
        planetId: planet.id,
        tick: 7,
        reason: "deterministic_seed",
        state,
        checksum: createHash("sha256").update(JSON.stringify(state)).digest("hex"),
      });
      await tx.insert(simulationTicks).values(
        Array.from({ length: 8 }, (_, tick) => ({
          planetId: planet.id,
          tick,
          status: "committed",
          metrics: tick === 7 ? state.summary : { seeded: true },
          completedAt: new Date(),
        })),
      );
      return planet.id;
    });
    return (await this.getWorldSummary(planetId))!;
  }
}
