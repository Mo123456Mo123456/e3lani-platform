import { z } from "zod";
import { BIOME_TYPES, CONTRIBUTION_CATEGORIES } from "@kawkab/shared-types";

/** Every numeric trait must live in [0,1]; multipliers in (0, 4]. */
export const traitsSchema = z
  .record(z.string().max(64), z.number().min(0).max(4))
  .superRefine((rec, ctx) => {
    for (const key of Object.keys(rec)) {
      if (key.endsWith("Multiplier")) {
        const v = rec[key];
        if (v !== undefined && (v <= 0 || v > 4)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} out of range` });
        }
      } else {
        const v = rec[key];
        if (v !== undefined && (v < 0 || v > 1)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} must be 0..1` });
        }
      }
    }
  });

export const parsedContributionSchema = z.object({
  category: z.enum(CONTRIBUTION_CATEGORIES),
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  traits: traitsSchema,
  possibleBiomes: z.array(z.enum(BIOME_TYPES)).max(12),
  risks: z.array(z.string().max(200)).max(10),
  benefits: z.array(z.string().max(200)).max(10),
});

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80),
  locale: z.enum(["ar", "en"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export const contributionCreateSchema = z.object({
  planetId: z.string().min(1),
  category: z.enum(CONTRIBUTION_CATEGORIES),
  text: z.string().min(3).max(4000),
  origin: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
});

export const contributionConfirmSchema = z.object({
  contributionId: z.string().min(1),
  originIndex: z.number().int().nonnegative(),
});

export type ParsedContributionInput = z.infer<typeof parsedContributionSchema>;
