import { z } from "zod";

export const localeSchema = z.enum(["ar", "en"]);

export const contributionCategorySchema = z.enum([
  "creature",
  "plant",
  "resource",
  "civilization",
  "city",
  "invention",
  "technology",
  "disease",
  "climate_phenomenon",
  "natural_law",
  "disaster",
  "alliance",
  "culture",
  "language",
  "transport",
  "energy_source",
  "custom",
]);

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(64),
  locale: localeSchema.default("ar"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const contributionIdeaSchema = z.object({
  category: contributionCategorySchema,
  idea: z.string().min(8).max(2000),
  locale: localeSchema.default("ar"),
  regionId: z.string().optional(),
});

export const contributionConfirmSchema = z.object({
  analysisId: z.string().min(1),
  regionId: z.string().min(1),
  runForecast: z.boolean().optional().default(true),
});

export const tickAdvanceSchema = z.object({
  steps: z.number().int().min(1).max(100).default(1),
});

export const moderationTextSchema = z.object({
  text: z.string().max(5000),
});

/** Block prompt injection / code execution attempts in user ideas */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s*prompt/i,
  /<\/?(script|iframe|img|svg)/i,
  /\b(drop|delete|truncate|alter)\s+(table|database)\b/i,
  /\beval\s*\(/i,
  /\bprocess\.env\b/i,
  /\bimport\s+os\b/i,
  /كمسؤول\s*النظام/i,
  /تجاهل\s*التعليمات/i,
];

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

export function sanitizeUserText(text: string): string {
  return text.replace(/[<>]/g, "").trim().slice(0, 2000);
}
