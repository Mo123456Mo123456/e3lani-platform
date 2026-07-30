/**
 * @planet/validation
 * Zod schemas guarding every trust boundary: user input, AI structured
 * output, realtime payloads. Nothing enters the engine unvalidated.
 */
import { z } from "zod";
import {
  BIOMES,
  CONTRIBUTION_CATEGORIES,
  EVENT_TYPES,
  RESOURCE_TYPES,
} from "@planet/shared-types";

export const biomeSchema = z.enum(BIOMES);
export const resourceTypeSchema = z.enum(RESOURCE_TYPES);
export const contributionCategorySchema = z.enum(CONTRIBUTION_CATEGORIES);
export const eventTypeSchema = z.enum(EVENT_TYPES);

const traitValue = z.number().min(0).max(1);

export const structuredContributionSchema = z.object({
  category: contributionCategorySchema,
  name: z.string().min(2).max(80),
  description: z.string().max(600).default(""),
  traits: z
    .record(z.string().min(1).max(40), traitValue)
    .refine((t) => Object.keys(t).length <= 16, "too many traits"),
  possibleBiomes: z.array(biomeSchema).max(6).default([]),
  risks: z.array(z.string().max(120)).max(8).default([]),
});

export const analyzeContributionInput = z.object({
  text: z.string().min(4).max(2000),
  category: contributionCategorySchema.optional(),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const placeContributionInput = z.object({
  analysisId: z.string().min(1),
  cell: z.number().int().nonnegative(),
  acceptBalanceSuggestion: z.boolean().default(false),
});

export const scenarioRequestSchema = z.object({
  horizonTicks: z.number().int().min(1).max(2000).default(200),
  runs: z.number().int().min(3).max(64).default(12),
});

export const registerInput = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(60),
});

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const refreshInput = z.object({
  refreshToken: z.string().min(10),
});

export const worldEventSchema = z.object({
  id: z.string(),
  planetId: z.string(),
  tick: z.number().int().nonnegative(),
  year: z.number(),
  type: eventTypeSchema,
  cell: z.number().int(),
  causeIds: z.array(z.string()),
  cause: z.string(),
  actors: z.array(
    z.object({ kind: z.string(), id: z.string(), name: z.string() }),
  ),
  data: z.record(z.union([z.number(), z.string(), z.boolean()])),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
  originUserId: z.string().nullable(),
  originContributionId: z.string().nullable(),
});

export const adminTickInput = z.object({
  ticks: z.number().int().min(1).max(5000).default(1),
});

export const paginationInput = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AnalyzeContributionInput = z.infer<typeof analyzeContributionInput>;
export type PlaceContributionInput = z.infer<typeof placeContributionInput>;
export type RegisterInput = z.infer<typeof registerInput>;
export type LoginInput = z.infer<typeof loginInput>;
