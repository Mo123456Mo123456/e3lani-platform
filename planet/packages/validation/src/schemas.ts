import { z } from "zod";
import { ContributionCategory } from "@planet/shared-types";

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(64),
  locale: z.enum(["ar", "en"]).default("ar"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const contributionDraftSchema = z.object({
  category: z.nativeEnum(ContributionCategory),
  text: z.string().min(4).max(2000),
  worldId: z.string().min(1),
});
export type ContributionDraftInput = z.infer<typeof contributionDraftSchema>;

const unitInterval = z.number().min(0).max(1);

/** Structured AI output contract — validated before anything reaches the engine. */
export const analyzedTraitsSchema = z.object({
  size: unitInterval,
  growthRate: unitInterval,
  waterNeed: unitInterval,
  energyOutput: unitInterval,
  pollutionAbsorption: unitInterval,
  pollutionEmission: unitInterval,
  coldResistance: unitInterval,
  heatResistance: unitInterval,
  aggression: unitInterval,
  intelligence: unitInterval,
  reproductionRate: unitInterval,
  lifespan: unitInterval,
  adaptability: unitInterval,
  rarity: unitInterval,
  nightLuminosity: unitInterval,
  toxicity: unitInterval,
  spreadRate: unitInterval,
});
export type AnalyzedTraitsInput = z.infer<typeof analyzedTraitsSchema>;

export const analyzedContributionSchema = z.object({
  category: z.nativeEnum(ContributionCategory),
  name: z.string().min(1).max(120),
  summary: z.string().min(1).max(2000),
  traits: analyzedTraitsSchema,
  possibleBiomes: z.array(z.string()).max(12),
  risks: z.array(z.string()).max(12),
  benefits: z.array(z.string()).max(12),
  sandbox: z.boolean(),
});
export type AnalyzedContributionInput = z.infer<typeof analyzedContributionSchema>;

export const contributionConfirmSchema = z.object({
  cellIndex: z.number().int().nonnegative(),
});
export type ContributionConfirmInput = z.infer<typeof contributionConfirmSchema>;

export const runTicksSchema = z.object({
  count: z.number().int().min(1).max(1000),
});
export type RunTicksInput = z.infer<typeof runTicksSchema>;

export const graphicsQualitySchema = z.enum(["ultra", "high", "medium", "power_saver"]);

export const adminRoleChangeSchema = z.object({
  userId: z.string().min(1),
  role: z.string().min(1),
});

export const rollbackSchema = z.object({
  tick: z.number().int().nonnegative(),
});
