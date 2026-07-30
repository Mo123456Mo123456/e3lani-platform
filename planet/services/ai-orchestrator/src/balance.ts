import type { AnalyzedContribution, BalanceResult } from "@planet/shared-types";

/**
 * Balance layer: rejects or re-scales "god-mode" additions. Instead of a flat
 * refusal, it proposes a nerfed-but-sensible variant the user can accept.
 */

const CAPS: { trait: keyof AnalyzedContribution["traits"]; cap: number; reason: string; suggestion: string }[] = [
  { trait: "lifespan", cap: 0.95, reason: "immortality_forbidden", suggestion: "long_lived_instead" },
  { trait: "reproductionRate", cap: 0.92, reason: "unbounded_reproduction_forbidden", suggestion: "high_fertility_with_predators" },
  { trait: "energyOutput", cap: 0.95, reason: "infinite_energy_forbidden", suggestion: "abundant_but_finite_energy" },
  { trait: "aggression", cap: 0.98, reason: "instant_planet_destruction_forbidden", suggestion: "formidable_but_defeatable" },
  { trait: "adaptability", cap: 0.95, reason: "universal_immunity_forbidden", suggestion: "highly_adaptable_with_weaknesses" },
];

const BANNED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /لا يموت|خالد للأبد|immortal|never dies|cannot die/i, reason: "immortality_forbidden" },
  { pattern: /بلا حدود|infinite|unlimited|endless/i, reason: "infinite_property_forbidden" },
  { pattern: /[يت]دمر الكوكب|يدمر|destroy the planet|end the world|ينهي العالم/i, reason: "instant_destruction_forbidden" },
  { pattern: /سيطرة مطلقة|total control|mind control everyone|يتحكم بكل/i, reason: "absolute_control_forbidden" },
  { pattern: /يلغي|illega|cancel all laws|break physics|خرق كل القوانين/i, reason: "law_cancellation_forbidden" },
];

export function checkBalance(rawText: string, analysis: AnalyzedContribution): BalanceResult {
  const reasons: string[] = [];
  const suggestions: string[] = [];

  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(rawText)) {
      reasons.push(reason);
      suggestions.push(suggestionFor(reason));
    }
  }

  const adjusted = { ...analysis.traits };
  let nerfed = false;
  for (const { trait, cap, reason, suggestion } of CAPS) {
    if ((analysis.traits[trait] ?? 0) > cap) {
      reasons.push(reason);
      suggestions.push(suggestion);
      adjusted[trait] = cap;
      nerfed = true;
    }
  }

  // Combos: fast spread + high toxicity = unchecked plague.
  if (adjusted.spreadRate > 0.85 && adjusted.toxicity > 0.85) {
    reasons.push("unchecked_plague_forbidden");
    suggestions.push("slower_spread_or_lower_toxicity");
    adjusted.spreadRate = 0.7;
    nerfed = true;
  }

  if (reasons.length === 0) return { verdict: "accept", reasons: [] };
  if (nerfed || reasons.length <= 2) {
    return {
      verdict: "adjust",
      reasons,
      suggestions,
      adjustedTraits: adjusted,
    };
  }
  return { verdict: "reject", reasons, suggestions };
}

function suggestionFor(reason: string): string {
  switch (reason) {
    case "immortality_forbidden": return "long_lived_instead";
    case "infinite_property_forbidden": return "large_but_finite";
    case "instant_destruction_forbidden": return "regional_hazard_with_warning_signs";
    case "absolute_control_forbidden": return "influence_through_culture";
    default: return "scaled_down_version";
  }
}
