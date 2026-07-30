import { z } from "zod";
import { CONTRIBUTION_CATEGORIES, ROLES } from "@planet/shared-types";

export const localeSchema = z.enum(["ar", "en"]).default("ar");

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z
    .string()
    .min(10, "password_too_short")
    .max(128)
    .regex(/[A-Za-z]/, "password_needs_letter")
    .regex(/[0-9]/, "password_needs_digit"),
  displayName: z.string().min(2).max(60),
  locale: localeSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(2048),
});

export const oauthSchema = z.object({
  provider: z.enum(["google", "apple"]),
  idToken: z.string().min(20),
});

export const contributionTextSchema = z.object({
  text: z.string().min(2).max(1200),
  locale: localeSchema.optional(),
  category: z.enum(CONTRIBUTION_CATEGORIES).optional(),
});

const traitValue = z.union([z.number().finite(), z.string().max(60)]);

export const structuredContributionSchema = z.object({
  category: z.enum(CONTRIBUTION_CATEGORIES),
  name: z.string().min(1).max(140),
  description: z.string().max(600).nullish(),
  traits: z.record(traitValue).default({}),
  possibleBiomes: z.array(z.string()).max(8).default([]),
  risks: z.array(z.string().max(60)).max(12).default([]),
  provider: z.string().default("unknown"),
  sandbox: z.boolean().default(true),
});

export const contributionDraftSchema = z.object({
  planetId: z.string().min(1).max(64),
  text: z.string().min(2).max(1200),
  category: z.enum(CONTRIBUTION_CATEGORIES).optional(),
});

export const contributionConfirmSchema = z.object({
  targetCellId: z.number().int().min(0).nullable().optional(),
  finalName: z.string().min(1).max(140).optional(),
  finalTraits: z.record(traitValue).optional(),
});

export const analyzeQuerySchema = z.object({
  locale: localeSchema.optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const eventFeedSchema = paginationSchema.extend({
  types: z.string().optional(),
  minImportance: z.coerce.number().int().min(1).max(5).optional(),
  civId: z.string().optional(),
  contributionId: z.string().optional(),
  fromTick: z.coerce.number().int().optional(),
  toTick: z.coerce.number().int().optional(),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(ROLES).optional(),
  suspended: z.boolean().optional(),
});

export const simControlSchema = z.object({
  action: z.enum(["pause", "resume", "tick", "rollback", "restart_era"]),
  ticks: z.number().int().min(1).max(500).optional(),
  snapshotId: z.string().optional(),
  tick: z.number().int().min(0).optional(),
});

export const moderationReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

export const analyticsBatchSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        props: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
        at: z.string().datetime().optional(),
      }),
    )
    .max(100),
});

export const scenarioRequestSchema = z.object({
  horizons: z.array(z.number().int().min(1).max(5000)).max(4).optional(),
  runs: z.number().int().min(2).max(16).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ContributionDraftInput = z.infer<typeof contributionDraftSchema>;
export type ContributionConfirmInput = z.infer<typeof contributionConfirmSchema>;
export type EventFeedInput = z.infer<typeof eventFeedSchema>;
export type SimControlInput = z.infer<typeof simControlSchema>;
