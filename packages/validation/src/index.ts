import { z } from "zod";
import { ContributionCategorySchema, TraitSchema } from "@kawkab/shared-types";

export const ContributionInputSchema = z.object({
  userId: z.string().min(1).optional(),
  planetId: z.string().min(1),
  category: ContributionCategorySchema,
  prompt: z.string().min(2).max(2000),
  traits: z.array(TraitSchema).default([]),
  targetRegionId: z.string().optional(),
  locale: z.enum(["ar", "en"]).default("ar")
});
export type ContributionInput = z.infer<typeof ContributionInputSchema>;

export interface BalanceResult {
  accepted: boolean;
  notes: string[];
  suggestedTraits: Array<z.infer<typeof TraitSchema>>;
}

const forbiddenPatterns = [
  /immortal|immortality|never dies|invincible|omnipotent|godlike/i,
  /infinite\s+(energy|power|food|resources)/i,
  /unlimited\s+(energy|power|food|resources)/i,
  /خلود|خالد|لا\s*يموت|طاقة\s*لا\s*نهائية|قوة\s*مطلقة|موارد\s*لا\s*تنتهي|لا\s*يقهر/i
];

const traitCaps: Record<string, number> = {
  strength: 0.85,
  intelligence: 0.9,
  fertility: 0.7,
  speed: 0.85,
  resilience: 0.85,
  toxicity: 0.6,
  energy: 0.75
};

export function balanceContribution(input: ContributionInput): BalanceResult {
  const notes: string[] = [];
  const text = `${input.prompt} ${input.traits.map((trait) => `${trait.name} ${trait.description ?? ""}`).join(" ")}`;
  if (forbiddenPatterns.some((pattern) => pattern.test(text))) {
    notes.push("Rejected: overpowered traits such as immortality, invincibility, or infinite energy break simulation balance.");
    return {
      accepted: false,
      notes,
      suggestedTraits: input.traits.map((trait) => ({ ...trait, value: Math.min(Math.abs(trait.value), traitCaps[trait.name.toLowerCase()] ?? 0.7) }))
    };
  }

  const suggestedTraits = input.traits.map((trait) => {
    const key = trait.name.toLowerCase();
    const cap = traitCaps[key] ?? 1;
    if (trait.value > cap) {
      notes.push(`Trait ${trait.name} was capped at ${cap} for ecological balance.`);
      return { ...trait, value: cap };
    }
    if (trait.value < 0) {
      notes.push(`Trait ${trait.name} was raised to 0 because negative trait magnitudes are not supported.`);
      return { ...trait, value: 0 };
    }
    return trait;
  });

  return { accepted: true, notes, suggestedTraits };
}

export function validateContribution(input: unknown): ContributionInput {
  return ContributionInputSchema.parse(input);
}
