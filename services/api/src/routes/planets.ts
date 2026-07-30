import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { adminTickInput, paginationInput, scenarioRequestSchema } from "@planet/validation";
import { runScenarios } from "@planet/simulation-models";
import { requireAuth, requireRole } from "../auth/guards.js";
import type { AppContext } from "../context.js";

export function registerPlanetRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/planets", {
    schema: { tags: ["planets"], summary: "List planets" },
  }, async () => {
    return { planets: await ctx.repository.listPlanets() };
  });

  app.get("/planets/:planetId", {
    schema: { tags: ["planets"], summary: "Planet summary + live stats" },
  }, async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const planets = await ctx.repository.listPlanets();
    const planet = planets.find((p) => p.id === planetId);
    if (!planet) return reply.code(404).send({ error: "not_found" });
    return { planet };
  });

  /**
   * The terrain is deterministic from the seed: the client regenerates the
   * full grid locally with @planet/simulation-models, so only the seed and
   * dimensions travel over the wire. Live state arrives via deltas.
   */
  app.get("/planets/:planetId/grid-config", {
    schema: { tags: ["planets"], summary: "Seed + grid dimensions for client-side regeneration" },
  }, async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const planets = await ctx.repository.listPlanets();
    const planet = planets.find((p) => p.id === planetId);
    if (!planet) return reply.code(404).send({ error: "not_found" });
    const engine = await ctx.worlds.ensureLoaded(planetId);
    return {
      seed: planet.seed,
      latBands: planet.latBands,
      lonBands: planet.lonBands,
      seaLevel: planet.seaLevel,
      currentTick: engine.state.tick,
      currentYear: engine.state.year,
      overlay: gridOverlay(engine.state),
    };
  });

  app.get("/planets/:planetId/regions/:cell", {
    schema: { tags: ["planets"], summary: "Region detail for one grid cell" },
  }, async (request, reply) => {
    const { planetId, cell } = request.params as { planetId: string; cell: string };
    const engine = await ctx.worlds.ensureLoaded(planetId);
    const index = Number(cell);
    const target = engine.state.grid.cells[index];
    if (!target) return reply.code(404).send({ error: "not_found" });
    const owner = engine.state.civs.find((c) => c.id === target.ownerId);
    const cities = engine.state.cities.filter((c) => c.cell === index && !c.destroyedAtTick);
    const species = engine.state.species.filter((s) => !s.extinctAtTick && s.habitat.includes(index));
    const plants = engine.state.plants.filter((p) => (p.coverage[index] ?? 0) > 0);
    const events = await ctx.repository.queryEvents({ planetId, cell: index, limit: 12, offset: 0 });
    return {
      cell: target,
      owner: owner ?? null,
      cities,
      species: species.map((s) => ({ id: s.id, name: s.name, diet: s.diet, population: s.population })),
      plants: plants.map((p) => ({ id: p.id, name: p.name, coverage: p.coverage[index] })),
      recentEvents: events,
    };
  });

  app.get("/planets/:planetId/events", {
    schema: { tags: ["planets"], summary: "Query the event journal" },
  }, async (request) => {
    const { planetId } = request.params as { planetId: string };
    const query = request.query as Record<string, string | undefined>;
    const page = paginationInput.parse(query);
    const events = await ctx.repository.queryEvents({
      planetId,
      type: query.type,
      cell: query.cell !== undefined ? Number(query.cell) : undefined,
      sinceTick: query.sinceTick !== undefined ? Number(query.sinceTick) : undefined,
      originUserId: query.originUserId,
      limit: page.limit,
      offset: page.offset,
    });
    const total = await ctx.repository.eventCount(planetId);
    return { events, total };
  });

  app.get("/planets/:planetId/timeline", {
    schema: { tags: ["planets"], summary: "Era-bucketed timeline + snapshots" },
  }, async (request) => {
    const { planetId } = request.params as { planetId: string };
    const engine = await ctx.worlds.ensureLoaded(planetId);
    const events = await ctx.repository.queryEvents({ planetId, limit: 100000, offset: 0 });
    const buckets = new Map<number, { year: number; count: number; types: Record<string, number>; highlights: string[] }>();
    for (const event of events) {
      const era = Math.floor(event.tick / 20) * 20;
      const bucket = buckets.get(era) ?? { year: event.year, count: 0, types: {}, highlights: [] };
      bucket.count++;
      bucket.types[event.type] = (bucket.types[event.type] ?? 0) + 1;
      if (event.importance >= 0.7 && bucket.highlights.length < 3) bucket.highlights.push(event.id);
      buckets.set(era, bucket);
    }
    return {
      currentTick: engine.state.tick,
      currentYear: engine.state.year,
      yearsPerTick: engine.state.yearsPerTick,
      eras: [...buckets.entries()].map(([tick, b]) => ({ tick, ...b })),
      snapshots: await ctx.repository.listSnapshotTicks(planetId),
    };
  });

  app.get("/planets/:planetId/state-summary", {
    schema: { tags: ["planets"], summary: "Live civilizations, wars, routes (for overlays)" },
  }, async (request) => {
    const { planetId } = request.params as { planetId: string };
    const engine = await ctx.worlds.ensureLoaded(planetId);
    const s = engine.state;
    return {
      tick: s.tick,
      year: s.year,
      civilizations: s.civs.map((c) => ({
        id: c.id, name: c.name, color: c.color, population: c.population,
        collapsed: c.collapsedAtTick !== null, techLevel: c.techLevel, stability: c.stability,
      })),
      cities: s.cities.filter((c) => !c.destroyedAtTick).map((c) => ({ id: c.id, name: c.name, cell: c.cell, civId: c.civId, population: c.population })),
      activeWars: s.wars.filter((w) => !w.endedAtTick),
      alliances: s.alliances.filter((a) => !a.dissolvedAtTick),
      tradeRoutes: s.tradeRoutes.filter((r) => r.active),
      migrations: s.migrations.slice(-50),
      stats: engine.stats(),
    };
  });

  // --- simulation control (simulation_admin and above) ----------------------

  app.post("/planets/:planetId/ticks", {
    preHandler: requireRole("simulation_admin"),
    schema: { tags: ["simulation"], summary: "Advance the simulation N ticks" },
  }, async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const parsed = adminTickInput.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(422).send({ error: "invalid_input" });
    const events = await ctx.worlds.advance(planetId, parsed.data.ticks);
    const engine = ctx.worlds.engineFor(planetId);
    await ctx.repository.audit(request.user.sub, "simulation_advanced", { planetId, ticks: parsed.data.ticks });
    return { tick: engine.state.tick, year: engine.state.year, eventsEmitted: events.length };
  });

  app.post("/planets/:planetId/pause", {
    preHandler: requireRole("simulation_admin"),
    schema: { tags: ["simulation"], summary: "Pause auto-ticking" },
  }, async (request) => {
    const { planetId } = request.params as { planetId: string };
    ctx.worlds.stopAutoTick(planetId);
    return { status: "paused" };
  });

  app.post("/planets/:planetId/resume", {
    preHandler: requireRole("simulation_admin"),
    schema: { tags: ["simulation"], summary: "Resume auto-ticking" },
  }, async (request) => {
    const { planetId } = request.params as { planetId: string };
    ctx.worlds.startAutoTick(planetId, ctx.env.AUTO_TICK_INTERVAL_MS);
    return { status: "running" };
  });

  app.post("/planets/:planetId/rollback", {
    preHandler: requireRole("simulation_admin"),
    schema: { tags: ["simulation"], summary: "Roll the world back to a snapshot tick" },
  }, async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const body = z.object({ tick: z.number().int().min(0) }).safeParse(request.body);
    if (!body.success) return reply.code(422).send({ error: "invalid_input" });
    const ok = await ctx.worlds.rollback(planetId, body.data.tick);
    if (!ok) return reply.code(409).send({ error: "rollback_failed", detail: "no snapshot at or before that tick" });
    const engine = ctx.worlds.engineFor(planetId);
    await ctx.repository.audit(request.user.sub, "simulation_rollback", { planetId, tick: body.data.tick });
    return { tick: engine.state.tick, year: engine.state.year };
  });

  app.post("/planets/:planetId/scenarios", {
    preHandler: requireAuth,
    schema: { tags: ["planets"], summary: "Monte Carlo futures — what happens after your addition?" },
  }, async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const parsed = scenarioRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(422).send({ error: "invalid_input" });
    const body = request.body as { contributionId?: string };
    const engine = await ctx.worlds.ensureLoaded(planetId);
    const report = runScenarios(engine, {
      horizonTicks: parsed.data.horizonTicks,
      runs: parsed.data.runs,
      contributionId: body?.contributionId,
    });
    ctx.tracker.track("scenario_requested", { userId: request.user.sub, planetId });
    return { report };
  });
}

/** compact per-cell overlay for first paint: owners, pollution, cities */
function gridOverlay(state: import("@planet/simulation-models").WorldState) {
  const owners: Record<number, string> = {};
  const pollution: Record<number, number> = {};
  for (const cell of state.grid.cells) {
    if (cell.ownerId) owners[cell.index] = cell.ownerId;
    if (cell.pollution > 0.05) pollution[cell.index] = Math.round(cell.pollution * 100) / 100;
  }
  return {
    owners,
    pollution,
    cities: state.cities.filter((c) => !c.destroyedAtTick).map((c) => ({ id: c.id, cell: c.cell, civId: c.civId, name: c.name, population: c.population })),
  };
}
