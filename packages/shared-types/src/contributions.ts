import { z } from "zod";

import {
  IdentifierSchema,
  LocalizedTextSchema,
  SignedUnitIntervalSchema,
  UnitIntervalSchema,
} from "./common.js";
import { SimulationEventTypeSchema } from "./events.js";
import {
  ResourceKindSchema,
  TechnologyDomainSchema,
} from "./world.js";

export const CONTRIBUTION_KINDS = [
  "PLANT",
  "RESOURCE",
  "SPECIES",
  "CIVILIZATION",
  "TECHNOLOGY",
] as const;

export const ContributionKindSchema = z.enum(CONTRIBUTION_KINDS);

const ContributionCommonShape = {
  id: IdentifierSchema,
  contributorId: IdentifierSchema.optional(),
  submittedAtTick: z.number().int().nonnegative(),
  name: LocalizedTextSchema,
  regionId: IdentifierSchema,
};

export const PlantContributionSchema = z
  .object({
    ...ContributionCommonShape,
    kind: z.literal("PLANT"),
    resilience: UnitIntervalSchema,
    growthRate: UnitIntervalSchema,
    nutrition: UnitIntervalSchema,
    invasiveness: UnitIntervalSchema,
  })
  .strict();

export const ResourceContributionSchema = z
  .object({
    ...ContributionCommonShape,
    kind: z.literal("RESOURCE"),
    resourceKind: ResourceKindSchema,
    abundance: UnitIntervalSchema,
    renewability: UnitIntervalSchema,
    strategicValue: UnitIntervalSchema,
    pollutionRisk: UnitIntervalSchema,
  })
  .strict();

export const SpeciesContributionSchema = z
  .object({
    ...ContributionCommonShape,
    kind: z.literal("SPECIES"),
    trophicLevel: z.enum(["PRODUCER", "HERBIVORE", "OMNIVORE", "PREDATOR"]),
    adaptability: UnitIntervalSchema,
    reproductionRate: UnitIntervalSchema,
    ecologicalImpact: SignedUnitIntervalSchema,
  })
  .strict();

export const CivilizationContributionSchema = z
  .object({
    ...ContributionCommonShape,
    kind: z.literal("CIVILIZATION"),
    foundingPopulation: z.number().finite().positive().max(1_000_000_000_000),
    technologyLevel: UnitIntervalSchema,
    stability: UnitIntervalSchema,
  })
  .strict();

export const TechnologyContributionSchema = z
  .object({
    ...ContributionCommonShape,
    kind: z.literal("TECHNOLOGY"),
    civilizationId: IdentifierSchema.optional(),
    domain: TechnologyDomainSchema,
    effectiveness: UnitIntervalSchema,
    pollutionEffect: SignedUnitIntervalSchema,
    populationEffect: SignedUnitIntervalSchema,
  })
  .strict();

export const ContributionInputSchema = z.discriminatedUnion("kind", [
  PlantContributionSchema,
  ResourceContributionSchema,
  SpeciesContributionSchema,
  CivilizationContributionSchema,
  TechnologyContributionSchema,
]);

export const ContributionProjectionSchema = z
  .object({
    populationDelta: z.number().finite(),
    carryingCapacityDelta: z.number().finite(),
    pollutionDelta: z.number().finite().min(-1).max(1),
    biodiversityDelta: z.number().finite().min(-1).max(1),
  })
  .strict();

export const ContributionAnalysisSchema = z
  .object({
    contributionId: IdentifierSchema,
    accepted: z.boolean(),
    confidence: UnitIntervalSchema,
    normalizedInput: ContributionInputSchema,
    projection: ContributionProjectionSchema,
    directEventTypes: z.array(SimulationEventTypeSchema),
    secondaryEventTypes: z.array(SimulationEventTypeSchema),
    warnings: z.array(LocalizedTextSchema),
    assumptions: z.array(LocalizedTextSchema),
  })
  .strict();

export type ContributionKind = z.infer<typeof ContributionKindSchema>;
export type PlantContribution = z.infer<typeof PlantContributionSchema>;
export type ResourceContribution = z.infer<typeof ResourceContributionSchema>;
export type SpeciesContribution = z.infer<typeof SpeciesContributionSchema>;
export type CivilizationContribution = z.infer<
  typeof CivilizationContributionSchema
>;
export type TechnologyContribution = z.infer<
  typeof TechnologyContributionSchema
>;
export type ContributionInput = z.infer<typeof ContributionInputSchema>;
export type ContributionProjection = z.infer<
  typeof ContributionProjectionSchema
>;
export type ContributionAnalysis = z.infer<
  typeof ContributionAnalysisSchema
>;
