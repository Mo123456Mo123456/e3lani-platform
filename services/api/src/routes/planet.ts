import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { advanceTicks } from "@planet/simulation-models";
import { tickAdvanceSchema } from "@planet/validation";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { loadWorldState, persistWorldState } from "../services/world-persistence.js";
import { broadcast } from "../ws/hub.js";

export async function planetRoutes(app: FastifyInstance) {
  app.get("/planets", async () => {
    const rows = await db.select().from(schema.planets);
    return { planets: rows };
  });

  app.get("/planets/:planetId", async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const [planet] = await db
      .select()
      .from(schema.planets)
      .where(eq(schema.planets.id, planetId))
      .limit(1);
    if (!planet) return reply.code(404).send({ error: "not_found" });

    const world = await loadWorldState(planetId);
    return {
      planet: {
        id: planet.id,
        name: planet.name,
        nameEn: planet.nameEn,
        seed: planet.seed,
        currentTick: planet.currentTick,
        currentYear: planet.currentYear,
        tickUnit: planet.tickUnit,
        civilizationCount: world?.civilizations.length ?? 0,
        cityCount: world?.cities.length ?? 0,
        speciesCount: world?.species.length ?? 0,
        plantCount: world?.plants.length ?? 0,
        resourceCount: world?.resources.length ?? 0,
        technologyCount: world?.technologies.length ?? 0,
        activeWars: world?.wars.filter((w) => w.active).length ?? 0,
        activeMigrations: world?.migrations.filter((m) => m.active).length ?? 0,
      },
      overlays: world
        ? {
            wars: world.wars.filter((w) => w.active).slice(0, 20),
            migrations: world.migrations.filter((m) => m.active).slice(0, 20),
            civilizations: world.civilizations.map((c) => ({
              id: c.id,
              name: c.name,
              nameEn: c.nameEn,
              population: c.population,
              capitalRegionId: c.capitalRegionId,
            })),
          }
        : null,
    };
  });

  app.get("/planets/:planetId/regions", async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const q = req.query as { biome?: string; limit?: string };
    const limit = Math.min(Number(q.limit ?? 200), 2000);
    let rows = await db
      .select()
      .from(schema.planetRegions)
      .where(eq(schema.planetRegions.planetId, planetId));
    if (q.biome) rows = rows.filter((r) => r.biome === q.biome);
    // Prefer interesting land cells first
    rows = rows
      .filter((r) => r.biome !== "ocean")
      .sort((a, b) => b.population - a.population || b.fertility - a.fertility)
      .slice(0, limit);
    return { regions: rows };
  });

  app.get("/planets/:planetId/regions/:regionId", async (req, reply) => {
    const { planetId, regionId } = req.params as { planetId: string; regionId: string };
    const [region] = await db
      .select()
      .from(schema.planetRegions)
      .where(eq(schema.planetRegions.id, regionId))
      .limit(1);
    if (!region || region.planetId !== planetId) {
      return reply.code(404).send({ error: "not_found" });
    }
    const world = await loadWorldState(planetId);
    const live = world?.regions.find((r) => r.id === regionId);
    const civ = live?.civilizationId
      ? world?.civilizations.find((c) => c.id === live.civilizationId)
      : undefined;
    return {
      region: live ?? region,
      civilization: civ ?? null,
      resources:
        world?.resources.filter((r) => r.regionId === regionId).slice(0, 20) ?? [],
      speciesCount: live?.speciesIds.length ?? 0,
      plantCount: live?.plantIds.length ?? 0,
    };
  });

  app.get("/planets/:planetId/events", async (req) => {
    const { planetId } = req.params as { planetId: string };
    const q = req.query as { limit?: string };
    const limit = Math.min(Number(q.limit ?? 40), 200);
    const events = await db
      .select()
      .from(schema.worldEvents)
      .where(eq(schema.worldEvents.planetId, planetId))
      .orderBy(desc(schema.worldEvents.tick), desc(schema.worldEvents.createdAt))
      .limit(limit);
    return { events };
  });

  app.get("/planets/:planetId/timeline", async (req) => {
    const { planetId } = req.params as { planetId: string };
    const events = await db
      .select()
      .from(schema.worldEvents)
      .where(eq(schema.worldEvents.planetId, planetId))
      .orderBy(schema.worldEvents.year)
      .limit(80);

    const milestones = [
      { year: 0, title: "نشأة المحيطات", titleEn: "Origin of Oceans", kind: "origin" },
      { year: 10, title: "ظهور الحياة", titleEn: "First Life", kind: "life" },
      { year: 40, title: "ظهور النباتات", titleEn: "Plant Era", kind: "plants" },
      { year: 80, title: "بداية الحضارات", titleEn: "Civilizations Dawn", kind: "civ" },
    ];

    const items = [
      ...milestones.map((m, i) => ({
        id: `milestone_${i}`,
        ...m,
        isLive: false,
      })),
      ...events.map((e) => ({
        id: e.id,
        year: e.year,
        title: e.title,
        titleEn: e.titleEn,
        kind: e.type,
        isLive: e.type === "WAR_STARTED",
        contributionId: e.contributionId ?? undefined,
      })),
    ].sort((a, b) => a.year - b.year);

    return { items };
  });

  app.get("/planets/:planetId/civilizations", async (req) => {
    const { planetId } = req.params as { planetId: string };
    const rows = await db
      .select()
      .from(schema.civilizations)
      .where(eq(schema.civilizations.planetId, planetId));
    return { civilizations: rows };
  });

  app.post(
    "/planets/:planetId/tick",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const user = req.user as { role: string };
      if (!["simulation_manager", "system_admin", "super_admin"].includes(user.role)) {
        return reply.code(403).send({ error: "forbidden" });
      }
      const { planetId } = req.params as { planetId: string };
      const parsed = tickAdvanceSchema.safeParse({
        ...(req.body as object),
        planetId,
      });
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const world = await loadWorldState(planetId);
      if (!world) return reply.code(404).send({ error: "world_missing" });
      const result = advanceTicks(world, parsed.data.ticks);
      await persistWorldState(planetId, result.state, { replace: true });
      await db.insert(schema.simulationTicks).values({
        planetId,
        tick: result.state.tick,
        year: result.state.year,
        eventCount: result.events.length,
      });

      broadcast(
        {
          type: "delta",
          ts: Date.now(),
          payload: {
            planetId,
            tick: result.state.tick,
            events: result.events,
            regionPatches: [],
            stats: {
              currentTick: result.state.tick,
              currentYear: result.state.year,
              activeWars: result.state.wars.filter((w) => w.active).length,
            },
          },
        },
        planetId,
      );

      return {
        tick: result.state.tick,
        year: result.state.year,
        events: result.events,
      };
    },
  );

  app.get("/planets/:planetId/snapshots", async (req) => {
    const { planetId } = req.params as { planetId: string };
    const rows = await db
      .select({
        id: schema.timelineSnapshots.id,
        label: schema.timelineSnapshots.label,
        tick: schema.timelineSnapshots.tick,
        year: schema.timelineSnapshots.year,
        createdAt: schema.timelineSnapshots.createdAt,
      })
      .from(schema.timelineSnapshots)
      .where(eq(schema.timelineSnapshots.planetId, planetId))
      .orderBy(desc(schema.timelineSnapshots.createdAt));
    return { snapshots: rows };
  });

  app.post(
    "/planets/:planetId/rollback",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const user = req.user as { role: string; id: string };
      if (!["simulation_manager", "system_admin", "super_admin"].includes(user.role)) {
        return reply.code(403).send({ error: "forbidden" });
      }
      const { planetId } = req.params as { planetId: string };
      const body = req.body as { snapshotId: string };
      const [snap] = await db
        .select()
        .from(schema.timelineSnapshots)
        .where(eq(schema.timelineSnapshots.id, body.snapshotId))
        .limit(1);
      if (!snap || snap.planetId !== planetId) {
        return reply.code(404).send({ error: "snapshot_not_found" });
      }
      const state = snap.state as unknown as import("@planet/simulation-models").WorldState;
      await persistWorldState(planetId, state, { replace: true });
      await db.insert(schema.auditLogs).values({
        actorId: user.id,
        action: "simulation.rollback",
        target: planetId,
        meta: { snapshotId: snap.id, tick: snap.tick },
      });
      return { ok: true, tick: state.tick, year: state.year };
    },
  );
}
