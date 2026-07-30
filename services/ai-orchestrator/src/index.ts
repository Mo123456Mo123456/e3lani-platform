import Fastify from "fastify";
import { detectInjection, sanitizeUserText } from "@planet/validation";
import type { ContributionCategory } from "@planet/shared-types";
import { createProvider } from "./providers.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 5001);
const provider = createProvider();

app.get("/health", async () => ({
  ok: true,
  service: "ai-orchestrator",
  provider: provider.name,
  sandbox: provider.name === "sandbox" || process.env.AI_SANDBOX_MODE !== "false",
}));

app.post("/v1/analyze", async (req, reply) => {
  const body = req.body as { category: ContributionCategory; idea: string; locale?: string };
  const idea = sanitizeUserText(body.idea ?? "");
  if (detectInjection(idea)) {
    return reply.code(400).send({
      structured: null,
      provider: "moderation",
      sandbox: true,
      moderation: { allowed: false, reasons: ["prompt_injection"] },
    });
  }
  try {
    const result = await provider.analyze(body.category, idea, body.locale ?? "ar");
    return {
      ...result,
      moderation: { allowed: true, reasons: [] },
    };
  } catch (e) {
    if (String(e).includes("INJECTION")) {
      return reply.code(400).send({
        moderation: { allowed: false, reasons: ["prompt_injection"] },
        provider: "moderation",
        sandbox: true,
      });
    }
    throw e;
  }
});

app.post("/v1/narrate", async (req) => {
  const body = req.body as {
    events: Array<{
      title: string;
      titleAr: string;
      description: string;
      descriptionAr: string;
      type: string;
    }>;
    locale?: string;
  };
  // Grounding: empty events ⇒ no invented story
  if (!body.events?.length) {
    return {
      narrative: "No events provided.",
      narrativeAr: "لم تُزوَّد أحداث.",
      provider: provider.name,
      sandbox: provider.name === "sandbox",
    };
  }
  return provider.narrate(body.events, body.locale ?? "ar");
});

app.post("/v1/moderate", async (req) => {
  const body = req.body as { text: string };
  const text = sanitizeUserText(body.text ?? "");
  const blocked = detectInjection(text);
  return {
    allowed: !blocked,
    reasons: blocked ? ["prompt_injection_or_forbidden"] : [],
  };
});

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`AI orchestrator (${provider.name}) on :${port}`);
});
