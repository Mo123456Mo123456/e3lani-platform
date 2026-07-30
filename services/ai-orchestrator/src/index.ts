import Fastify from "fastify";
import { createProvider, moderateText, narrateEvents, parseContribution } from "@kawkab/ai";
import { checkBalance, expectedEffects } from "@kawkab/simulation";
import type { ContributionCategory, Locale, NarrationFact, WorldEvent } from "@kawkab/shared-types";

/**
 * AI Orchestrator — the single gateway for every model call in the platform.
 * Provider is selected by env; without keys it runs the deterministic sandbox
 * and says so explicitly in every response.
 */
const provider = createProvider(process.env);
const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok", provider: provider.name, sandbox: provider.sandbox }));

app.get("/v1/provider", async () => ({ name: provider.name, model: provider.model, sandbox: provider.sandbox }));

interface ParseBody {
  text: string;
  category?: ContributionCategory;
  locale?: Locale;
}

app.post<{ Body: ParseBody }>("/v1/parse", async (req, reply) => {
  const { text, category, locale = "ar" } = req.body ?? {};
  if (!text || text.trim().length < 3) {
    return reply.code(400).send({ error: "text is required (min 3 chars)" });
  }
  const outcome = await parseContribution(provider, { text, category, locale });
  return { ...outcome, sandbox: provider.sandbox };
});

app.post<{ Body: ParseBody }>("/v1/preview", async (req, reply) => {
  const { text, category, locale = "ar" } = req.body ?? {};
  if (!text || text.trim().length < 3) {
    return reply.code(400).send({ error: "text is required (min 3 chars)" });
  }
  const outcome = await parseContribution(provider, { text, category, locale });
  const balance = checkBalance(outcome.parsed);
  const effects = expectedEffects(balance.adjusted);
  return {
    parsed: outcome.parsed,
    balance,
    expectedShortTerm: effects.shortTerm,
    expectedLongTerm: effects.longTerm,
    usage: outcome.usage,
    sandbox: provider.sandbox,
  };
});

interface NarrateBody {
  events: WorldEvent[];
  facts: NarrationFact[];
  locale?: Locale;
}

app.post<{ Body: NarrateBody }>("/v1/narrate", async (req, reply) => {
  const { events, facts, locale = "ar" } = req.body ?? {};
  if (!Array.isArray(events) || !Array.isArray(facts)) {
    return reply.code(400).send({ error: "events and facts arrays are required" });
  }
  const outcome = await narrateEvents(provider, events, facts, locale);
  return { ...outcome, sandbox: provider.sandbox };
});

app.post<{ Body: { text: string } }>("/v1/moderate", async (req, reply) => {
  const { text } = req.body ?? {};
  if (typeof text !== "string") return reply.code(400).send({ error: "text is required" });
  return moderateText(text);
});

const port = Number(process.env.PORT ?? 4100);
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`ai-orchestrator on :${port} provider=${provider.name} sandbox=${provider.sandbox}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
