import { z } from "zod";
import { ElementCategorySchema, StructuredElementSchema } from "@planet/shared-types";

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const AnalyzeContributionSchema = z.object({
  text: z.string().min(3).max(2000),
  category: ElementCategorySchema.optional(),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const ConfirmContributionSchema = z.object({
  analysisId: z.string().min(1),
  regionId: z.string().min(1),
  acceptBalance: z.boolean().default(true),
});

export const TickControlSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
  yearsPerTick: z.number().int().min(1).max(100).default(1),
});

export const FutureProjectionSchema = z.object({
  years: z.array(z.number().int().positive()).default([1, 10, 100, 1000]),
  samples: z.number().int().min(2).max(32).default(8),
  contributionId: z.string().optional(),
});

export const ModerationSchema = z.object({
  text: z.string(),
});

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s*prompt/i,
  /;\s*drop\s+table/i,
  /<\s*script/i,
  /\$\{.*\}/,
  /`{3,}[\s\S]*exec/i,
  /rm\s+-rf/i,
];

export function detectPromptInjection(text: string): {
  blocked: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const p of INJECTION_PATTERNS) {
    if (p.test(text)) reasons.push(`pattern:${p.source.slice(0, 40)}`);
  }
  if (text.length > 2000) reasons.push("too_long");
  return { blocked: reasons.length > 0, reasons };
}

export { StructuredElementSchema, ElementCategorySchema };
