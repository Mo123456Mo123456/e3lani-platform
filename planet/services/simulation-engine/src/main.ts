import Fastify from "fastify";
import { analyzedContributionSchema, runTicksSchema, rollbackSchema } from "@planet/validation";
import { runTicks, applyContribution, runFutureScenarios, queryEvents } from "@planet/simulation-models";
import { WorldRegistry, EngineError } from "./registry.js";
import { gridView, regionInfo, snapshotView, speciesView, worldMeta, worldStats } from "./views.js";

const PORT = Number(process.env["PORT"] ?? 4100);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const INTERNAL_TOKEN = process.env["ENGINE_INTERNAL_TOKEN"] ?? "";

export function buildServer(registry = new WorldRegistry()) {
  const app = Fastify({ logger: process.env["NODE_ENV"] !== "test" });

  app.addHook("onRequest", async (req, reply) => {
    reply.header("access-control-allow-origin", process.env["CORS_ORIGIN"] ?? "*");
    reply.header("access-control-allow-headers", "content-type, x-internal-token");
    reply.header("access-control-allow-methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return reply.send();
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof EngineError) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "internal_engine_error" });
  });

  app.get("/health", async () => ({ status: "ok", worlds: registry.list().length }));

  app.get("/worlds", async () => registry.list());

  app.post<{ Body: { worldId: string; name: string; seed: number; yearsPerTick?: number } }>(
    "/worlds",
    async (req, reply) => {
      const { worldId, name, seed, yearsPerTick } = req.body ?? {};
      if (!worldId || typeof seed !== "number") {
        return reply.status(400).send({ error: "worldId_and_seed_required" });
      }
      const world = registry.create({ worldId, name: name ?? worldId, seed, yearsPerTick });
      return { meta: worldMeta(world), stats: worldStats(world) };
    },
  );

  app.get<{ Params: { id: string } }>("/worlds/:id", async (req) => {
    const world = registry.require(req.params.id);
    return { meta: worldMeta(world), stats: worldStats(world) };
  });

  app.get<{ Params: { id: string } }>("/worlds/:id/grid", async (req) => {
    return gridView(registry.require(req.params.id));
  });

  app.get<{ Params: { id: string } }>("/worlds/:id/snapshot", async (req) => {
    return snapshotView(registry.require(req.params.id));
  });

  app.get<{ Params: { id: string; cell: string } }>("/worlds/:id/regions/:cell", async (req, reply) => {
    const info = regionInfo(registry.require(req.params.id), Number(req.params.cell));
    if (!info) return reply.status(404).send({ error: "cell_out_of_bounds" });
    return info;
  });

  app.get<{ Params: { id: string }; Querystring: { contributionId?: string } }>(
    "/worlds/:id/species",
    async (req) => speciesView(registry.require(req.params.id), req.query.contributionId),
  );

  app.get<{ Params: { id: string }; Querystring: { beforeSeq?: string; limit?: string } }>(
    "/worlds/:id/events",
    async (req) => {
      const world = registry.require(req.params.id);
      const beforeSeq = req.query.beforeSeq !== undefined ? Number(req.query.beforeSeq) : undefined;
      const limit = req.query.limit !== undefined ? Number(req.query.limit) : 50;
      return queryEvents(world.events, { beforeSeq, limit });
    },
  );

  app.post<{ Params: { id: string }; Body: { count: number } }>("/worlds/:id/ticks", async (req, reply) => {
    const parsed = runTicksSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message });
    const world = registry.require(req.params.id);
    const events = runTicks(world, parsed.data.count);
    if (world.tick % 25 < parsed.data.count) registry.snapshot(world);
    return { tick: world.tick, year: world.tick * world.yearsPerTick, eventCount: events.length, events: events.slice(-200) };
  });

  app.post<{ Params: { id: string }; Body: { contributionId: string; analysis: unknown; cellIndex: number; runTicks?: number } }>(
    "/worlds/:id/contributions",
    async (req, reply) => {
      const world = registry.require(req.params.id);
      const parsed = analyzedContributionSchema.safeParse(req.body?.analysis);
      if (!parsed.success) {
        return reply.status(422).send({ error: "invalid_analysis", issues: parsed.error.issues.slice(0, 5) });
      }
      const { contributionId, cellIndex } = req.body;
      if (!contributionId || typeof cellIndex !== "number") {
        return reply.status(400).send({ error: "contributionId_and_cellIndex_required" });
      }
      const result = applyContribution(world, contributionId, parsed.data, cellIndex);
      if (!result.ok) return reply.status(422).send({ error: result.reason });
      const followTicks = Math.min(req.body.runTicks ?? 12, 100);
      const events = runTicks(world, followTicks);
      registry.snapshot(world);
      const related = world.events.filter((e) => e.contributionId === contributionId);
      return {
        applied: true,
        rootEvent: result.rootEvent,
        entityId: result.entityId,
        tick: world.tick,
        simulatedTicks: followTicks,
        contributionEvents: related,
        newEvents: events.slice(-100),
      };
    },
  );

  app.post<{ Params: { id: string }; Body: { contributionId: string; analysis: unknown; cellIndex: number; horizons?: number[]; runs?: number } }>(
    "/worlds/:id/contributions/preview",
    async (req, reply) => {
      const world = registry.require(req.params.id);
      const parsed = analyzedContributionSchema.safeParse(req.body?.analysis);
      if (!parsed.success) {
        return reply.status(422).send({ error: "invalid_analysis", issues: parsed.error.issues.slice(0, 5) });
      }
      const { contributionId, cellIndex } = req.body;
      if (!contributionId || typeof cellIndex !== "number") {
        return reply.status(400).send({ error: "contributionId_and_cellIndex_required" });
      }
      const preview = runFutureScenarios(world, contributionId, parsed.data, cellIndex, {
        horizons: req.body.horizons ?? [1, 10, 100, 1000],
        runsPerHorizon: Math.min(req.body.runs ?? 6, 10),
      });
      return preview;
    },
  );

  app.post<{ Params: { id: string }; Body: { tick: number } }>("/worlds/:id/rollback", async (req, reply) => {
    const parsed = rollbackSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "tick_required" });
    const world = registry.rollback(req.params.id, parsed.data.tick);
    return { meta: worldMeta(world), stats: worldStats(world) };
  });

  app.get<{ Params: { id: string } }>("/worlds/:id/snapshots", async (req) => {
    return registry.snapshotList(req.params.id);
  });

  void INTERNAL_TOKEN; // reserved for mTLS/JWT hardening in production topology
  return app;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (isMain) {
  const app = buildServer();
  app.listen({ port: PORT, host: HOST }).then(() => {
    console.log(`simulation-engine listening on :${PORT}`);
  });
}
