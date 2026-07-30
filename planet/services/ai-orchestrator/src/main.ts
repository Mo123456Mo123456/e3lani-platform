import Fastify from "fastify";
import { ContributionCategory } from "@planet/shared-types";
import { z } from "zod";
import { Orchestrator } from "./orchestrator.js";
import { checkBalance } from "./balance.js";
import { moderateText } from "./moderation.js";

const PORT = Number(process.env["PORT"] ?? 4200);
const HOST = process.env["HOST"] ?? "0.0.0.0";

const analyzeBody = z.object({
  category: z.nativeEnum(ContributionCategory),
  text: z.string().min(1).max(4000),
  locale: z.enum(["ar", "en"]).default("ar"),
  userId: z.string().default("anonymous"),
});

const narrateBody = z.object({
  locale: z.enum(["ar", "en"]).default("ar"),
  facts: z.array(
    z.object({
      type: z.string(),
      year: z.number(),
      cellIndex: z.number().optional(),
      numbers: z.record(z.number()).optional(),
      names: z.record(z.string()).optional(),
    }),
  ).max(50),
});

export function buildServer(orchestrator = new Orchestrator()) {
  const app = Fastify({ logger: process.env["NODE_ENV"] !== "test" });

  app.addHook("onRequest", async (req, reply) => {
    reply.header("access-control-allow-origin", process.env["CORS_ORIGIN"] ?? "*");
    reply.header("access-control-allow-headers", "content-type");
    reply.header("access-control-allow-methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return reply.send();
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/providers", async () => ({
    active: orchestrator.activeProviderName(),
    providers: orchestrator.statuses(),
  }));

  app.post("/analyze", async (req, reply) => {
    const parsed = analyzeBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message });

    // 1) Moderation gate.
    const moderation = moderateText(parsed.data.text, parsed.data.userId);
    if (!moderation.allowed) {
      return reply.status(422).send({ error: "moderation_blocked", flags: moderation.flags });
    }

    // 2) AI analysis (structured + validated).
    const analysis = await orchestrator.analyze({
      category: parsed.data.category,
      text: parsed.data.text,
      locale: parsed.data.locale,
    });

    // 3) Balance gate.
    const balance = checkBalance(parsed.data.text, analysis);
    return { analysis, balance, moderation: { flags: moderation.flags } };
  });

  app.post("/narrate", async (req, reply) => {
    const parsed = narrateBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message });
    const result = await orchestrator.narrate(parsed.data);
    return { ...result, provider: orchestrator.activeProviderName() };
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (isMain) {
  const app = buildServer();
  app.listen({ port: PORT, host: HOST }).then(() => {
    console.log(`ai-orchestrator listening on :${PORT}`);
  });
}
