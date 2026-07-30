import Fastify from "fastify";
import {
  applyContribution,
  createInitialWorld,
  deserializeWorldState,
  runFutureScenarios,
  serializeWorldState,
  stepSimulation,
  type WorldState,
} from "@planet-born/simulation-models";
import { StructuredContributionSchema } from "@planet-born/shared-types";
import { z } from "zod";

const StateSchema = z.union([z.string(), z.record(z.string(), z.unknown())]);
const transport = (state: WorldState) => JSON.parse(serializeWorldState(state));
const hydrate = (state: z.infer<typeof StateSchema>) =>
  deserializeWorldState(typeof state === "string" ? state : JSON.stringify(state));

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return reply.code(400).send({ error: "INVALID_SIMULATION_INPUT" });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "SIMULATION_FAILED" });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "@planet-born/simulation-engine",
  }));

  app.post("/world/create", async (request) => {
    const { seed, tickUnit } = z
      .object({
        seed: z.string().min(1).max(256),
        tickUnit: z.enum(["day", "month", "year", "decade"]).default("year"),
      })
      .parse(request.body);
    return { state: transport(createInitialWorld(seed, tickUnit)) };
  });

  app.post("/world/step", async (request) => {
    const input = z
      .object({
        state: StateSchema,
        ticks: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(request.body);
    const state = stepSimulation(hydrate(input.state), input.ticks);
    return { state: transport(state), events: state.events };
  });

  app.post("/world/apply-contribution", async (request) => {
    const input = z
      .object({
        state: StateSchema,
        contribution: StructuredContributionSchema,
        location: z.object({
          lat: z.number().min(-90).max(90),
          lon: z.number().min(-180).max(180),
        }),
        userId: z.string().uuid().optional(),
      })
      .parse(request.body);
    const result = applyContribution(
      hydrate(input.state),
      input.contribution,
      input.location,
      input.userId,
    );
    return { ...result, state: transport(result.state) };
  });

  app.post("/world/scenarios", async (request) => {
    const input = z
      .object({
        state: StateSchema,
        horizons: z.array(z.number().int().positive()).min(1).max(20),
        samples: z.number().int().min(3).max(50).default(12),
      })
      .parse(request.body);
    return {
      scenarios: runFutureScenarios(
        hydrate(input.state),
        input.horizons,
        input.samples,
      ),
    };
  });

  return app;
}
