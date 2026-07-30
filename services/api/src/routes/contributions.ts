import type { FastifyInstance } from "fastify";
import {
  analyzeContributionSchema,
  commitContributionSchema,
  previewContributionSchema,
} from "../domain/contracts.js";

const contributionBody = {
  type: "object",
  required: ["planetId", "proposal"],
  additionalProperties: false,
  properties: {
    planetId: { type: "string", format: "uuid" },
    proposal: { type: "string", minLength: 10, maxLength: 2_000 },
    clientContext: {
      type: "object",
      additionalProperties: false,
      properties: {
        regionId: { type: "string", format: "uuid" },
        civilizationId: { type: "string", format: "uuid" },
      },
    },
  },
} as const;

export async function contributionRoutes(app: FastifyInstance) {
  app.post(
    "/contribution/analyze",
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["contributions"],
        summary: "Moderate, ground, and analyze a contribution",
        body: contributionBody,
      },
    },
    async (request) => {
      const input = analyzeContributionSchema.parse(request.body);
      const analysis = await app.contributionService.analyze(request.user.sub, input);
      return { data: { analysis, provider: app.aiProvider.status } };
    },
  );

  app.post(
    "/contribution/preview",
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["contributions"],
        summary: "Run a deterministic Monte Carlo contribution preview",
        body: {
          ...contributionBody,
          properties: {
            ...contributionBody.properties,
            samples: { type: "integer", minimum: 50, maximum: 2_000, default: 250 },
          },
        },
      },
    },
    async (request) => {
      const { samples, ...input } = previewContributionSchema.parse(request.body);
      return {
        data: await app.contributionService.preview(request.user.sub, input, samples),
      };
    },
  );

  app.post(
    "/contribution/commit",
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        tags: ["contributions"],
        summary: "Atomically commit a grounded contribution and simulation tick",
        body: {
          ...contributionBody,
          required: [...contributionBody.required, "idempotencyKey"],
          properties: {
            ...contributionBody.properties,
            idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const { idempotencyKey, ...input } = commitContributionSchema.parse(request.body);
      const committed = await app.contributionService.commit(
        request.user.sub,
        input,
        idempotencyKey,
      );
      return reply.code(committed.result.replayed ? 200 : 201).send({ data: committed });
    },
  );
}
