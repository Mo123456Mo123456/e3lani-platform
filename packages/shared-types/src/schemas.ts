import { z } from "zod";
import {
  BiomeTypeSchema,
  ContributionCategorySchema,
  LocaleSchema,
  TickUnitSchema,
  UserRoleSchema,
  WorldEventTypeSchema,
} from "./enums.js";

export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Vec2 = z.infer<typeof Vec2Schema>;

export const LatLonSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type LatLon = z.infer<typeof LatLonSchema>;

export const TraitMapSchema = z.record(z.string(), z.number().min(0).max(1));
export type TraitMap = z.infer<typeof TraitMapSchema>;

export const StructuredContributionSchema = z.object({
  category: ContributionCategorySchema,
  name: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  traits: TraitMapSchema,
  possibleBiomes: z.array(BiomeTypeSchema).min(1),
  risks: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  balanceScore: z.number().min(0).max(1).optional(),
  wasBalanced: z.boolean().default(false),
  balanceNotes: z.array(z.string()).default([]),
});
export type StructuredContribution = z.infer<typeof StructuredContributionSchema>;

export const AnalyzeContributionRequestSchema = z.object({
  idea: z.string().min(3).max(2000),
  category: ContributionCategorySchema.optional(),
  locale: LocaleSchema.default("ar"),
});
export type AnalyzeContributionRequest = z.infer<
  typeof AnalyzeContributionRequestSchema
>;

export const ConfirmContributionRequestSchema = z.object({
  planetId: z.string().uuid(),
  structured: StructuredContributionSchema,
  location: LatLonSchema,
  regionId: z.string().uuid().optional(),
  runPreviewYears: z.number().int().min(1).max(1000).default(10),
});
export type ConfirmContributionRequest = z.infer<
  typeof ConfirmContributionRequestSchema
>;

export const WorldEventSchema = z.object({
  id: z.string().uuid(),
  planetId: z.string().uuid(),
  type: WorldEventTypeSchema,
  title: z.string(),
  titleEn: z.string().optional(),
  description: z.string(),
  descriptionEn: z.string().optional(),
  tick: z.number().int().nonnegative(),
  simYear: z.number(),
  regionId: z.string().uuid().nullable().optional(),
  location: LatLonSchema.nullable().optional(),
  importance: z.number().min(0).max(1),
  cause: z.string().nullable().optional(),
  causeIds: z.array(z.string()).default([]),
  actorIds: z.array(z.string()).default([]),
  contributionId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  directEffects: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(1),
  thumbnailUrl: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const CausalLinkSchema = z.object({
  id: z.string().uuid(),
  planetId: z.string().uuid(),
  fromEventId: z.string().uuid(),
  toEventId: z.string().uuid(),
  relation: z.enum([
    "caused",
    "amplified",
    "mitigated",
    "enabled",
    "blocked",
    "correlated",
  ]),
  strength: z.number().min(0).max(1),
  delayTicks: z.number().int().nonnegative(),
  explanation: z.string().optional(),
});
export type CausalLink = z.infer<typeof CausalLinkSchema>;

export const SimulationTickRequestSchema = z.object({
  planetId: z.string().uuid(),
  ticks: z.number().int().min(1).max(1000).default(1),
  unit: TickUnitSchema.default("year"),
});
export type SimulationTickRequest = z.infer<typeof SimulationTickRequestSchema>;

export const FutureScenarioRequestSchema = z.object({
  planetId: z.string().uuid(),
  contributionId: z.string().uuid().optional(),
  horizons: z.array(z.number().int().positive()).default([1, 10, 100, 1000]),
  samples: z.number().int().min(3).max(50).default(12),
});
export type FutureScenarioRequest = z.infer<typeof FutureScenarioRequestSchema>;

export const AuthRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80),
  locale: LocaleSchema.default("ar"),
});
export type AuthRegister = z.infer<typeof AuthRegisterSchema>;

export const AuthLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type AuthLogin = z.infer<typeof AuthLoginSchema>;

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: UserRoleSchema,
  locale: LocaleSchema,
  level: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const RegionSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  nameEn: z.string().optional(),
  biome: BiomeTypeSchema,
  lat: z.number(),
  lon: z.number(),
  elevation: z.number(),
  temperature: z.number(),
  moisture: z.number(),
  fertility: z.number(),
  population: z.number().int().nonnegative(),
  pollution: z.number().min(0).max(1),
  resources: z.number().int().nonnegative(),
  civilizationId: z.string().uuid().nullable().optional(),
});
export type RegionSummary = z.infer<typeof RegionSummarySchema>;

export const PlanetSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  nameEn: z.string().optional(),
  seed: z.string(),
  currentTick: z.number().int().nonnegative(),
  currentYear: z.number(),
  tickUnit: TickUnitSchema,
  status: z.enum(["running", "paused", "rollback"]),
  civilizationCount: z.number().int(),
  speciesCount: z.number().int(),
  plantCount: z.number().int(),
  resourceCount: z.number().int(),
  cityCount: z.number().int(),
  technologyCount: z.number().int(),
});
export type PlanetSummary = z.infer<typeof PlanetSummarySchema>;

export const UserImpactStatsSchema = z.object({
  elementsAdded: z.number().int().nonnegative(),
  totalChanges: z.number().int().nonnegative(),
  evolutionDays: z.number().int().nonnegative(),
  civilizationsAffected: z.number().int().nonnegative(),
  lastEventTitle: z.string().nullable(),
});
export type UserImpactStats = z.infer<typeof UserImpactStatsSchema>;

export const NarrativeResultSchema = z.object({
  locale: LocaleSchema,
  summary: z.string(),
  groundedEventIds: z.array(z.string().uuid()),
  provider: z.string(),
  sandbox: z.boolean(),
});
export type NarrativeResult = z.infer<typeof NarrativeResultSchema>;

export const FutureScenarioSchema = z.object({
  horizonYears: z.number(),
  mostLikely: z.object({
    narrative: z.string(),
    metrics: z.record(z.string(), z.number()),
    probability: z.number().min(0).max(1),
  }),
  best: z.object({
    narrative: z.string(),
    metrics: z.record(z.string(), z.number()),
  }),
  worst: z.object({
    narrative: z.string(),
    metrics: z.record(z.string(), z.number()),
  }),
  uncertainty: z.number().min(0).max(1),
  drivers: z.array(z.string()),
  sandbox: z.boolean().optional(),
});
export type FutureScenario = z.infer<typeof FutureScenarioSchema>;

/** Realtime WebSocket payload envelope */
export const WsEnvelopeSchema = z.object({
  type: z.string(),
  planetId: z.string().uuid().optional(),
  payload: z.unknown(),
  ts: z.number(),
});
export type WsEnvelope = z.infer<typeof WsEnvelopeSchema>;
