import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { tickAdvanceSchema } from "@planet/validation";
import { requireAuth } from "../lib/auth.js";
import { db } from "../db/client.js";
import {
  getPrimaryPlanet,
  getPlanetSummary,
  listRegions,
  getRegion,
  listEvents,
  runTicks,
  getCausalGraph,
  asWorldState,
  rollbackToSnapshot,
} from "../services/world-service.js";
import { auditLogs, planets, timelineSnapshots } from "../db/schema.js";

export async function planetRoutes(app: FastifyInstance) {
  app.get("/planet", async () => {
    const planet = await getPrimaryPlanet();
    if (!planet) return { planet: null };
    const summary = await getPlanetSummary(planet.id);
    return { planet: summary };
  });

  app.get("/planet/state", async () => {
    const planet = await getPrimaryPlanet();
    if (!planet) return { state: null };
    const state = asWorldState(planet);
    // Return lean state for clients (not full 800 plants detail always)
    return {
      state: {
        planetId: planet.id,
        seed: state.seed,
        tick: state.tick,
        year: state.year,
        name: state.name,
        nameAr: state.nameAr,
        regions: state.regions.map((r) => ({
          id: r.id,
          name: r.name,
          nameAr: r.nameAr,
          biome: r.biome,
          lat: r.lat,
          lon: r.lon,
          elevation: r.elevation,
          temperature: r.temperature,
          moisture: r.moisture,
          fertility: r.fertility,
          pollution: r.pollution,
          population: r.population,
        })),
        civilizations: state.civilizations.map((c) => ({
          id: c.id,
          name: c.name,
          nameAr: c.nameAr,
          population: c.population,
          regionIds: c.regionIds,
          military: c.military,
          economy: c.economy,
          stability: c.stability,
          techLevel: c.techLevel,
        })),
        cities: state.cities,
        wars: state.wars,
        migrations: state.migrations,
        tradeRoutes: state.tradeRoutes,
        contributions: state.contributions,
        overlays: {
          speciesCount: state.species.length,
          plantCount: state.plants.length,
          resourceCount: state.resources.length,
          technologyCount: state.technologies.length,
          activeDiseases: state.diseases.length,
        },
      },
    };
  });

  app.get("/planet/regions", async () => {
    const planet = await getPrimaryPlanet();
    if (!planet) return { regions: [] };
    const regions = await listRegions(planet.id);
    return {
      regions: regions.map((r) => ({
        ...r,
        simId: (r.data as { simId?: string }).simId,
      })),
    };
  });

  app.get<{ Params: { id: string } }>("/planet/regions/:id", async (req, reply) => {
    const planet = await getPrimaryPlanet();
    if (!planet) return reply.code(404).send({ error: "not_found" });
    const region = await getRegion(planet.id, req.params.id);
    if (!region) return reply.code(404).send({ error: "not_found" });
    const state = asWorldState(planet);
    const simId = (region.data as { simId?: string }).simId ?? req.params.id;
    const local = {
      resources: state.resources.filter((r) => r.regionId === simId).slice(0, 20),
      species: state.species.filter((s) => s.regionIds.includes(simId)).slice(0, 20),
      plants: state.plants.filter((p) => p.regionIds.includes(simId)).slice(0, 20),
      cities: state.cities.filter((c) => c.regionId === simId),
      civilizations: state.civilizations.filter((c) => c.regionIds.includes(simId)),
    };
    return { region, local };
  });

  app.get("/planet/events", async (req) => {
    const planet = await getPrimaryPlanet();
    if (!planet) return { events: [] };
    const limit = Number((req.query as { limit?: string }).limit ?? 40);
    const events = await listEvents(planet.id, limit);
    return { events };
  });

  app.get("/planet/timeline", async () => {
    const planet = await getPrimaryPlanet();
    if (!planet) return { snapshots: [], milestones: [] };
    const snapshots = await db
      .select({
        id: timelineSnapshots.id,
        tick: timelineSnapshots.tick,
        year: timelineSnapshots.year,
        label: timelineSnapshots.label,
        labelAr: timelineSnapshots.labelAr,
        stateHash: timelineSnapshots.stateHash,
        createdAt: timelineSnapshots.createdAt,
      })
      .from(timelineSnapshots)
      .where(eq(timelineSnapshots.planetId, planet.id))
      .orderBy(desc(timelineSnapshots.year))
      .limit(50);

    const state = asWorldState(planet);
    const milestones = state.events
      .filter((e) => (e.payload as { bootstrap?: boolean }).bootstrap || e.importance >= 0.8)
      .slice(0, 40)
      .map((e) => ({
        id: e.id,
        year: e.year,
        title: e.title,
        titleAr: e.titleAr,
        type: e.type,
        importance: e.importance,
        contributionId: e.contributionId,
      }));

    return { snapshots, milestones, currentTick: planet.tick, currentYear: planet.year };
  });

  app.get("/planet/causal", async (req) => {
    const planet = await getPrimaryPlanet();
    if (!planet) return { events: [], links: [] };
    const contributionId = (req.query as { contributionId?: string }).contributionId;
    return getCausalGraph(planet.id, contributionId);
  });

  app.post("/planet/tick", { preHandler: requireAuth() }, async (req, reply) => {
    const body = tickAdvanceSchema.parse(req.body ?? {});
    const planet = await getPrimaryPlanet();
    if (!planet) return reply.code(404).send({ error: "not_found" });
    const result = await runTicks(planet.id, body.steps);
    await db.insert(auditLogs).values({
      actorId: req.dbUser!.id,
      action: "simulation.tick",
      targetType: "planet",
      targetId: planet.id,
      meta: { steps: body.steps, tick: result.state.tick },
    });
    // broadcast via decorator
    app.broadcast?.({
      channel: "world.tick",
      type: "tick.completed",
      payload: { tick: result.state.tick, year: result.state.year, metrics: result.metrics, events: result.newEvents.slice(0, 10) },
      ts: new Date().toISOString(),
      planetId: planet.id,
    });
    return {
      tick: result.state.tick,
      year: result.state.year,
      metrics: result.metrics,
      newEvents: result.newEvents.filter((e) => e.type !== "TICK_COMPLETED"),
    };
  });

  app.post<{ Params: { id: string } }>(
    "/admin/snapshots/:id/rollback",
    { preHandler: requireAuth("simulation_manager") },
    async (req, reply) => {
      const planet = await getPrimaryPlanet();
      if (!planet) return reply.code(404).send({ error: "not_found" });
      const state = await rollbackToSnapshot(planet.id, req.params.id);
      await db.insert(auditLogs).values({
        actorId: req.dbUser!.id,
        action: "simulation.rollback",
        targetType: "snapshot",
        targetId: req.params.id,
      });
      return { ok: true, tick: state.tick, year: state.year };
    },
  );

  app.post("/admin/simulation/pause", { preHandler: requireAuth("simulation_manager") }, async () => {
    const planet = await getPrimaryPlanet();
    if (!planet) return { ok: false };
    await db.update(planets).set({ status: "paused" }).where(eq(planets.id, planet.id));
    return { ok: true, status: "paused" };
  });

  app.post("/admin/simulation/resume", { preHandler: requireAuth("simulation_manager") }, async () => {
    const planet = await getPrimaryPlanet();
    if (!planet) return { ok: false };
    await db.update(planets).set({ status: "running" }).where(eq(planets.id, planet.id));
    return { ok: true, status: "running" };
  });
}
