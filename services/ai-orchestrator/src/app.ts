import Fastify from "fastify";
import {
  AnalyzeContributionRequestSchema,
  NarrativeResultSchema,
  StructuredContributionSchema,
} from "@planet-born/shared-types";
import { balanceContribution } from "@planet-born/simulation-models";
import {
  moderateContributionIdea,
  ModerationDecisionSchema,
} from "@planet-born/validation";
import { z } from "zod";
import {
  MockProvider,
  selectProvider,
  type AiProvider,
} from "./providers.js";

const NarrativeRequestSchema = z.object({
  locale: z.enum(["ar", "en"]).default("ar"),
  events: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1),
        titleEn: z.string().optional(),
      }),
    )
    .max(100),
});

export async function buildApp(options: {
  provider?: AiProvider;
  logger?: boolean;
} = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const provider = options.provider ?? selectProvider();
  const mock = new MockProvider();

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        issues: error.issues,
      });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "AI_OPERATION_FAILED" });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "@planet-born/ai-orchestrator",
    provider: provider.name,
    sandbox: provider.sandbox,
  }));

  app.post("/analyze", async (request, reply) => {
    const input = AnalyzeContributionRequestSchema.parse(request.body);
    const moderation = moderateContributionIdea(input.idea);
    if (!moderation.allowed) {
      return reply.code(422).send({ error: "IDEA_REJECTED", moderation });
    }
    try {
      return StructuredContributionSchema.parse(await provider.analyze(input));
    } catch (error) {
      app.log.warn({ error }, "Configured provider failed; using sandbox provider");
      return StructuredContributionSchema.parse(await mock.analyze(input));
    }
  });

  app.post("/balance", async (request) => {
    const contribution = StructuredContributionSchema.parse(request.body);
    return balanceContribution(contribution);
  });

  app.post("/narrate", async (request) => {
    const input = NarrativeRequestSchema.parse(request.body);
    // Deliberately compose from the supplied titles instead of free-form generation.
    // This makes event invention structurally impossible.
    const titles = input.events.map((event) =>
      input.locale === "en" ? (event.titleEn ?? event.title) : event.title,
    );
    const summary =
      titles.length === 0
        ? input.locale === "ar"
          ? "لا توجد أحداث للسرد."
          : "There are no events to narrate."
        : input.locale === "ar"
          ? `تسلسل الأحداث: ${titles.join("، ")}.`
          : `Event sequence: ${titles.join("; ")}.`;
    return NarrativeResultSchema.parse({
      locale: input.locale,
      summary,
      groundedEventIds: input.events.map((event) => event.id),
      provider: provider.name,
      sandbox: provider.sandbox,
    });
  });

  app.post("/moderate", async (request) => {
    const { idea } = z.object({ idea: z.string().min(1).max(2_000) }).parse(request.body);
    return ModerationDecisionSchema.parse(moderateContributionIdea(idea));
  });

  return app;
}
