import { z } from "zod";
import { contributionCategories } from "@living-planet/shared-types";

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const analyzeContributionSchema = z.object({
  category: z.enum(contributionCategories),
  idea: z.string().trim().min(12).max(2_000),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const analyzedContributionSchema = z.object({
  category: z.enum(contributionCategories),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2_000),
  traits: z.record(z.string(), z.number().min(0).max(1)).refine(
    (traits) => Object.keys(traits).length <= 32,
    "No more than 32 numeric traits are allowed",
  ),
  possibleBiomes: z.array(
    z.enum([
      "ocean",
      "coast",
      "plains",
      "tropical_forest",
      "temperate_forest",
      "desert",
      "mountain",
      "tundra",
      "wetland",
      "steppe",
      "volcanic",
      "ice",
    ]),
  ).min(1).max(12),
  risks: z.array(z.string().regex(/^[a-z0-9_]+$/).max(80)).max(16),
  balance: z.object({
    score: z.number().min(0).max(1),
    adjusted: z.boolean(),
    adjustments: z.array(z.string().max(240)).max(16),
  }),
  provider: z.string().max(40),
  sandbox: z.boolean(),
});

export const previewContributionSchema = z.object({
  planetId: z.string().uuid(),
  regionId: z.string().min(3).max(80),
  contribution: analyzedContributionSchema,
});

export const confirmContributionSchema = previewContributionSchema.extend({
  idempotencyKey: z.string().uuid(),
  originalIdea: z.string().trim().min(12).max(2_000),
});

const forbiddenPatterns = [
  /ignore\s+(all|previous|system)\s+instructions/i,
  /<\s*script/i,
  /\b(drop|truncate|alter)\s+table\b/i,
  /\b(exec|spawn|system)\s*\(/i,
  /\{\{.*(?:constructor|prototype).*}}/i,
];

export function inspectUserText(text: string): { safe: boolean; reasons: string[] } {
  const reasons = forbiddenPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `blocked_pattern:${pattern.source.slice(0, 32)}`);
  return { safe: reasons.length === 0, reasons };
}
