import "dotenv/config";
import Fastify from "fastify";
import { generateWorld } from "@planet-born/simulation-models";
import { z } from "zod";

const app = Fastify({ logger: true });
const RequestSchema = z.object({
  seed: z.string().min(1).max(256),
  width: z.number().int().min(8).max(512).default(64),
  height: z.number().int().min(4).max(256).default(32),
});

app.get("/health", async () => ({
  status: "ok",
  service: "@planet-born/world-generator",
}));

const generate = async (request: { body: unknown }) => {
  const input = RequestSchema.parse(request.body);
  return generateWorld(input.seed, input.width, input.height);
};

app.post("/generate", generate);
app.post("/world/generate", generate);

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: "INVALID_GENERATOR_INPUT", issues: error.issues });
  }
  app.log.error(error);
  return reply.code(500).send({ error: "GENERATION_FAILED" });
});

try {
  await app.listen({
    port: Number(process.env.PORT ?? 4400),
    host: process.env.HOST ?? "0.0.0.0",
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
