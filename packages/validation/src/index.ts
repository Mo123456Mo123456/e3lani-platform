import { StructuredContributionSchema } from "@planet-born/shared-types";
import { z } from "zod";

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /<\s*script/i,
  /DROP\s+TABLE/i,
  /;\s*DELETE\s+FROM/i,
  /\$\{.*\}/,
  /`{3,}[\s\S]*exec/i,
];

const FORBIDDEN_POWER_PATTERNS = [
  /لا يموت|immortal|invincible|لا يموت أبدا/i,
  /تكاثر بلا حدود|infinite reproduction|unlimited spawn/i,
  /يدمر الكوكب|destroy the planet|wipe all life/i,
  /طاقة غير محدودة|unlimited energy|infinite power/i,
  /يلغي جميع القوانين|override all laws|god mode/i,
  /سيطرة مطلقة|absolute control|omnipotent/i,
];

export function detectPromptInjection(text: string): {
  flagged: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`injection_pattern:${pattern.source.slice(0, 40)}`);
    }
  }
  return { flagged: reasons.length > 0, reasons };
}

export function detectForbiddenPowers(text: string): {
  flagged: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const pattern of FORBIDDEN_POWER_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`forbidden_power:${pattern.source.slice(0, 40)}`);
    }
  }
  return { flagged: reasons.length > 0, reasons };
}

export function sanitizeUserIdea(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 2000);
}

export function validateStructuredContribution(input: unknown) {
  return StructuredContributionSchema.safeParse(input);
}

export const ModerationDecisionSchema = z.object({
  allowed: z.boolean(),
  needsReview: z.boolean(),
  reasons: z.array(z.string()),
  sanitizedIdea: z.string().optional(),
});
export type ModerationDecision = z.infer<typeof ModerationDecisionSchema>;

export function moderateContributionIdea(idea: string): ModerationDecision {
  const sanitizedIdea = sanitizeUserIdea(idea);
  const injection = detectPromptInjection(sanitizedIdea);
  const powers = detectForbiddenPowers(sanitizedIdea);
  const reasons = [...injection.reasons, ...powers.reasons];

  if (injection.flagged) {
    return {
      allowed: false,
      needsReview: true,
      reasons,
      sanitizedIdea,
    };
  }

  // Forbidden powers are not hard-blocked: balance layer will rewrite them.
  return {
    allowed: true,
    needsReview: powers.flagged,
    reasons,
    sanitizedIdea,
  };
}
