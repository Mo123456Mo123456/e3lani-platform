import { z } from "zod";

export const elementCategorySchema = z.enum([
  "creature",
  "plant",
  "resource",
  "civilization",
  "invention",
  "natural_phenomenon",
  "disease",
  "culture",
  "world_law",
  "custom",
]);

export const roleSchema = z.enum([
  "visitor",
  "user",
  "explorer",
  "life_maker",
  "civ_creator",
  "historian",
  "content_mod",
  "sim_manager",
  "admin",
  "super_admin",
]);

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(64),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const createContributionSchema = z.object({
  planetId: z.string().uuid().or(z.string().min(1)),
  category: elementCategorySchema,
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(8000),
  traits: z.record(z.unknown()).default({}),
});

export const analyzeElementSchema = z.object({
  contributionId: z.string().min(1),
  category: elementCategorySchema,
  title: z.string().min(1),
  description: z.string().min(1),
  traits: z.record(z.unknown()).default({}),
});

export const moderateContributionSchema = z.object({
  contributionId: z.string().min(1),
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
  flags: z.array(z.string()).default([]),
});

export const injectElementSchema = z.object({
  planetId: z.string().min(1),
  contributionId: z.string().min(1),
  category: elementCategorySchema,
  title: z.string().min(1),
  traits: z.record(z.unknown()),
  regionId: z.string().optional(),
});

export const forecastSchema = z.object({
  planetId: z.string().min(1),
  years: z.number().int().positive().max(10_000).default(100),
  monteCarloRuns: z.number().int().positive().max(200).default(24),
});

export const createPlanetSchema = z.object({
  name: z.string().min(2).max(80),
  seed: z.string().min(1).max(128).optional(),
  resolution: z.number().int().min(16).max(512).default(64),
  description: z.string().max(2000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateContributionInput = z.infer<typeof createContributionSchema>;
export type AnalyzeElementInput = z.infer<typeof analyzeElementSchema>;
export type ModerateContributionInput = z.infer<typeof moderateContributionSchema>;
export type InjectElementInput = z.infer<typeof injectElementSchema>;
export type ForecastInput = z.infer<typeof forecastSchema>;
export type CreatePlanetInput = z.infer<typeof createPlanetSchema>;
