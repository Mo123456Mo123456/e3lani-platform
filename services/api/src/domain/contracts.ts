import { z } from "zod";

export const roleSchema = z.enum([
  "guest",
  "user",
  "explorer",
  "life_maker",
  "civilization_creator",
  "historian",
  "moderator",
  "content_moderator",
  "simulation_manager",
  "admin",
  "system_admin",
  "super_admin",
]);
export type Role = z.infer<typeof roleSchema>;

export const contributionInputSchema = z.object({
  planetId: z.string().uuid(),
  proposal: z.string().trim().min(10).max(2_000),
  clientContext: z
    .object({
      regionId: z.string().uuid().optional(),
      civilizationId: z.string().uuid().optional(),
    })
    .strict()
    .optional(),
}).strict();
export type ContributionInput = z.infer<typeof contributionInputSchema>;

export const analyzeContributionSchema = contributionInputSchema;
export const previewContributionSchema = contributionInputSchema.extend({
  samples: z.coerce.number().int().min(50).max(2_000).default(250),
});
export const commitContributionSchema = contributionInputSchema.extend({
  idempotencyKey: z.string().min(8).max(128),
});

export const accountSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(80),
  password: z.string().min(12).max(128),
  requestedRole: roleSchema.default("user"),
}).strict();

export const sessionSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const effectSchema = z
  .object({
    metric: z.enum([
      "stability",
      "biodiversity",
      "temperature",
      "population",
      "prosperity",
      "pollution",
    ]),
    delta: z.number().finite().min(-0.25).max(0.25),
    regionId: z.string().uuid().nullable(),
    civilizationId: z.string().uuid().nullable(),
    rationale: z.string().trim().min(3).max(300),
  })
  .strict();

export const contributionAnalysisSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().min(10).max(800),
    category: z.enum([
      "ecology",
      "climate",
      "society",
      "technology",
      "diplomacy",
      "health",
      "economy",
    ]),
    plausibility: z.number().finite().min(0).max(1),
    confidence: z.number().finite().min(0).max(1),
    effects: z.array(effectSchema).min(1).max(8),
    causalEventIds: z.array(z.string().uuid()).max(8),
    warnings: z.array(z.string().trim().min(1).max(240)).max(8),
  })
  .strict();
export type ContributionAnalysis = z.infer<typeof contributionAnalysisSchema>;

/**
 * Advisory provider output. Numeric world effects and causal links are
 * intentionally absent: only the deterministic simulation layer may create
 * those fields.
 */
export const aiAdvisorySchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().min(10).max(800),
    category: z.enum([
      "ecology",
      "climate",
      "society",
      "technology",
      "diplomacy",
      "health",
      "economy",
    ]),
    plausibility: z.number().finite().min(0).max(1),
    confidence: z.number().finite().min(0).max(1),
    warnings: z.array(z.string().trim().min(1).max(240)).max(8),
  })
  .strict();
export type AiAdvisory = z.infer<typeof aiAdvisorySchema>;

export type UserIdentity = {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
};

export type PlanetSummary = {
  id: string;
  name: string;
  slug: string;
  currentTick: number;
  isPaused: boolean;
  stability: number;
  biodiversity: number;
  averageTemperature: number;
  population: number;
  counts: {
    regions: number;
    civilizations: number;
    cities: number;
    resources: number;
    species: number;
    plants: number;
    technologies: number;
  };
};

export type WorldRegion = {
  id: string;
  planetId: string;
  name: string;
  biome: string;
  latitude: number;
  longitude: number;
  population: number;
  stability: number;
};

export type WorldEvent = {
  id: string;
  planetId: string;
  tick: number;
  title: string;
  summary: string;
  category: string;
  magnitude: number;
  causedByContributionId?: string | undefined;
  createdAt: string;
};

export type TimelineSnapshot = {
  id: string;
  planetId: string;
  tick: number;
  reason: string;
  state: Record<string, unknown>;
  createdAt: string;
};

export type GroundingContext = {
  summary: PlanetSummary;
  regionIds: string[];
  civilizationIds: string[];
  recentEventIds: string[];
};

export type ModerationDecision = {
  allowed: boolean;
  risk: "none" | "low" | "high";
  reasons: string[];
};

export type MonteCarloPreview = {
  samples: number;
  acceptanceProbability: number;
  riskOfInstability: number;
  projectedEffects: Array<{
    metric: z.infer<typeof effectSchema>["metric"];
    p10: number;
    median: number;
    p90: number;
  }>;
};

export type CommitResult = {
  contributionId: string;
  tick: number;
  events: WorldEvent[];
  snapshotId: string;
  replayed: boolean;
};
