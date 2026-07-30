import { z } from "zod";
import { BIOMES, CONTRIBUTION_CATEGORIES, ROLES } from "@planet/config";

export const emailSchema = z.string().email().max(254);
export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().min(2).max(80),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const contributionIdeaSchema = z.object({
  category: z.enum(CONTRIBUTION_CATEGORIES),
  idea: z
    .string()
    .min(8)
    .max(2000)
    .refine(
      (v) =>
        !/(drop\s+table|;\s*--|<\/?script|system\(|eval\(|__proto__)/i.test(v),
      "Content rejected by safety rules",
    ),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const applyContributionSchema = z.object({
  planetId: z.string().uuid(),
  category: z.enum(CONTRIBUTION_CATEGORIES),
  idea: z.string().min(8).max(2000),
  regionId: z.string().min(3).max(120),
  structured: z.object({
    category: z.enum(CONTRIBUTION_CATEGORIES),
    name: z.string().min(2).max(120),
    nameEn: z.string().max(120).optional(),
    description: z.string().max(2000),
    traits: z.record(z.number().min(0).max(1)),
    possibleBiomes: z.array(z.enum(BIOMES)).min(1),
    risks: z.array(z.string()).max(20),
    benefits: z.array(z.string()).max(20),
    balanceNotes: z.array(z.string()).max(20),
    wasBalanced: z.boolean(),
    originalIdea: z.string(),
  }),
  runHorizons: z.array(z.number().int().positive()).default([1, 10, 100]),
});

export const roleSchema = z.enum(ROLES);

export const tickAdvanceSchema = z.object({
  planetId: z.string().uuid(),
  ticks: z.number().int().min(1).max(1000).default(1),
});

export const regionQuerySchema = z.object({
  planetId: z.string().uuid(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ContributionIdeaInput = z.infer<typeof contributionIdeaSchema>;
export type ApplyContributionInput = z.infer<typeof applyContributionSchema>;
