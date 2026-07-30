import Fastify from "fastify";
import { contributionIdeaSchema } from "@planet/validation";
import { createProvider } from "./providers/index.js";
import { z } from "zod";

const app = Fastify({ logger: true });
const provider = createProvider();

app.get("/health", async () => ({
  ok: true,
  provider: provider.name,
  sandbox: provider.sandbox,
}));

app.post("/v1/parse-idea", async (req, reply) => {
  const parsed = contributionIdeaSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  const structured = await provider.parseIdea(parsed.data);
  return {
    structured,
    provider: provider.name,
    sandbox: provider.sandbox,
  };
});

const narrateSchema = z.object({
  locale: z.enum(["ar", "en"]).default("ar"),
  contributionName: z.string(),
  effects: z.array(
    z.object({
      domain: z.string(),
      metric: z.string(),
      delta: z.number(),
      confidence: z.number().optional(),
      explanationKey: z.string().optional(),
    }),
  ),
  eventTitles: z.array(z.string()).default([]),
});

app.post("/v1/narrate", async (req, reply) => {
  const parsed = narrateSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  const narrative = await provider.narrate(parsed.data);
  return {
    ...narrative,
    provider: provider.name,
    sandbox: provider.sandbox,
  };
});

const port = Number(process.env.AI_ORCHESTRATOR_PORT ?? process.env.PORT ?? 4101);

if (process.env.NODE_ENV !== "test") {
  app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

export { app, provider };
