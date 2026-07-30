/**
 * Standalone Simulation Engine HTTP service.
 * Keeps tick logic out of the web UI. API can call this or use the library directly.
 */
import Fastify from "fastify";
import {
  advanceTick,
  applyContribution,
  generateWorld,
  hashWorld,
  runFutureScenarios,
  type WorldState,
} from "@planet/simulation-models";
import type { StructuredContribution } from "@planet/shared-types";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 4001);

app.get("/health", async () => ({ ok: true, service: "simulation-engine" }));

app.post("/v1/generate", async (req) => {
  const body = req.body as { seed: number; planetId?: string; full?: boolean };
  const state = generateWorld({
    planetId: body.planetId ?? "sim",
    seed: body.seed,
    full: body.full ?? true,
  });
  return { state, hash: hashWorld(state) };
});

app.post("/v1/tick", async (req) => {
  const body = req.body as { state: WorldState; steps?: number };
  const result = advanceTick(body.state, body.steps ?? 1);
  return { ...result, hash: hashWorld(result.state) };
});

app.post("/v1/apply", async (req) => {
  const body = req.body as {
    state: WorldState;
    contribution: StructuredContribution;
    regionId: string;
    userId: string;
    contributionId: string;
  };
  const result = applyContribution(
    body.state,
    body.contribution,
    body.regionId,
    body.userId,
    body.contributionId,
  );
  return result;
});

app.post("/v1/forecast", async (req) => {
  const body = req.body as {
    state: WorldState;
    contribution: StructuredContribution;
    regionId: string;
    userId: string;
    contributionId: string;
  };
  const scenarios = runFutureScenarios(body.state, {
    contribution: body.contribution,
    regionId: body.regionId,
    userId: body.userId,
    contributionId: body.contributionId,
  });
  return { scenarios, probabilistic: true };
});

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`Simulation engine on :${port}`);
});
