import Fastify from "fastify";
import { z } from "zod";
import {
  advanceTicks,
  applyContribution,
  generateWorld,
  runMonteCarloForecast,
  type WorldState,
} from "@planet/simulation-models";

const app = Fastify({ logger: true });

/** In-memory hot state cache keyed by planetId — authoritative snapshots also live in API DB. */
const worlds = new Map<string, WorldState>();

app.get("/health", async () => ({ ok: true, worlds: worlds.size }));

app.post("/v1/generate", async (req, reply) => {
  const body = z
    .object({
      planetId: z.string(),
      seed: z.number().int(),
    })
    .safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error.flatten());
  const world = generateWorld(body.data);
  worlds.set(world.planetId, world);
  return {
    planetId: world.planetId,
    seed: world.seed,
    regionCount: world.regions.length,
    civilizationCount: world.civilizations.length,
    cityCount: world.cities.length,
    resourceCount: world.resources.length,
    speciesCount: world.species.length,
    plantCount: world.plants.length,
    technologyCount: world.technologies.length,
  };
});

app.post("/v1/load", async (req, reply) => {
  const body = z.object({ state: z.any() }).safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error.flatten());
  const state = body.data.state as WorldState;
  worlds.set(state.planetId, state);
  return { ok: true, tick: state.tick };
});

app.get("/v1/worlds/:planetId", async (req, reply) => {
  const { planetId } = req.params as { planetId: string };
  const world = worlds.get(planetId);
  if (!world) return reply.code(404).send({ error: "not_found" });
  return summarize(world);
});

app.get("/v1/worlds/:planetId/full", async (req, reply) => {
  const { planetId } = req.params as { planetId: string };
  const world = worlds.get(planetId);
  if (!world) return reply.code(404).send({ error: "not_found" });
  return world;
});

app.post("/v1/tick", async (req, reply) => {
  const body = z
    .object({ planetId: z.string(), ticks: z.number().int().min(1).max(1000).default(1) })
    .safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error.flatten());
  const world = worlds.get(body.data.planetId);
  if (!world) return reply.code(404).send({ error: "not_found" });
  const result = advanceTicks(world, body.data.ticks);
  worlds.set(body.data.planetId, result.state);
  return {
    summary: summarize(result.state),
    events: result.events,
    effects: result.effects,
    causalGraph: result.causalGraph,
  };
});

app.post("/v1/contribute", async (req, reply) => {
  const body = z
    .object({
      planetId: z.string(),
      userId: z.string(),
      contributionId: z.string(),
      regionId: z.string(),
      structured: z.any(),
      simulateYears: z.number().int().min(0).max(1000).default(1),
    })
    .safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error.flatten());
  const world = worlds.get(body.data.planetId);
  if (!world) return reply.code(404).send({ error: "not_found" });
  const result = applyContribution({
    state: world,
    userId: body.data.userId,
    contributionId: body.data.contributionId,
    regionId: body.data.regionId,
    structured: body.data.structured,
    simulateYears: body.data.simulateYears,
  });
  worlds.set(body.data.planetId, result.state);
  return result;
});

app.post("/v1/forecast", async (req, reply) => {
  const body = z
    .object({
      planetId: z.string(),
      horizons: z.array(z.number().int().positive()).default([1, 10, 100, 1000]),
      samples: z.number().int().min(1).max(32).default(6),
    })
    .safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error.flatten());
  const world = worlds.get(body.data.planetId);
  if (!world) return reply.code(404).send({ error: "not_found" });
  const cappedHorizons = body.data.horizons.map((h) => Math.min(h, 200));
  return {
    note: "Probabilistic Monte Carlo — not a certainty forecast",
    results: runMonteCarloForecast(world, cappedHorizons, body.data.samples).map((bundle) => ({
      horizonYears: bundle.horizonYears,
      pathCount: bundle.paths.length,
      eventCounts: bundle.paths.map((p) => p.events.length),
    })),
  };
});

function summarize(world: WorldState) {
  return {
    planetId: world.planetId,
    seed: world.seed,
    tick: world.tick,
    year: world.year,
    civilizationCount: world.civilizations.length,
    cityCount: world.cities.length,
    speciesCount: world.species.length,
    plantCount: world.plants.length,
    resourceCount: world.resources.length,
    technologyCount: world.technologies.length,
    activeWars: world.wars.filter((w) => w.active).length,
    activeMigrations: world.migrations.filter((m) => m.active).length,
    eventCount: world.eventLog.length,
  };
}

const port = Number(process.env.SIMULATION_ENGINE_PORT ?? process.env.PORT ?? 4102);
if (process.env.NODE_ENV !== "test") {
  app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

export { app, worlds };
