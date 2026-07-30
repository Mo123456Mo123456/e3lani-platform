/**
 * Contribution balance validator — the algorithmic gate that keeps the world
 * simulatable. Overpowered additions are not silently accepted nor bluntly
 * rejected: the validator computes a power budget, flags violations and
 * produces a concrete balanced suggestion (auto-nerf) instead.
 */
import type {
  BalanceReport,
  BalanceViolation,
  ContributionCategory,
  StructuredContribution,
} from "@planet/shared-types";

/** relative power weight of each known trait (0..1 each) */
const TRAIT_WEIGHTS: Record<string, number> = {
  size: 0.5,
  lifespan: 0.8,
  reproductionRate: 1.0,
  growthRate: 0.9,
  heatResistance: 0.4,
  coldResistance: 0.4,
  waterNeed: -0.3, // needs are weaknesses, not powers
  intelligence: 0.9,
  aggression: 0.7,
  mobility: 0.5,
  adaptability: 0.9,
  mutationRate: 0.6,
  pollutionAbsorption: 0.7,
  nightLuminosity: 0.3,
  energyStorage: 0.9,
  toxicity: 0.8,
  photosynthetic: 0.6,
  yield: 0.8,
  rarity: -0.2,
  value: 0.9,
  virulence: 0.9,
  contagiousness: 0.9,
  severity: 0.9,
};

/** power budget per category — roughly "one strong trait + two modest ones" */
const CATEGORY_BUDGETS: Record<ContributionCategory, number> = {
  creature: 1.6,
  plant: 1.6,
  resource: 1.4,
  civilization: 1.5,
  invention: 1.5,
  phenomenon: 1.3,
  disease: 1.2,
  culture: 1.2,
  law: 1.0,
  custom: 1.2,
};

/** trait combinations that no single addition may max out together */
const FORBIDDEN_COMBOS: Array<{ traits: string[]; threshold: number; message: string }> = [
  {
    traits: ["reproductionRate", "adaptability", "toxicity"],
    threshold: 2.4,
    message: "unkillable plague: extreme reproduction + adaptability + toxicity",
  },
  {
    traits: ["lifespan", "reproductionRate", "adaptability"],
    threshold: 2.6,
    message: "immortal swarm: cannot die out and spreads without bound",
  },
  {
    traits: ["energyStorage", "growthRate", "pollutionAbsorption"],
    threshold: 2.7,
    message: "infinite free energy loop breaks the resource economy",
  },
];

export function powerScore(contribution: StructuredContribution): number {
  let score = 0;
  for (const [trait, value] of Object.entries(contribution.traits)) {
    const weight = TRAIT_WEIGHTS[trait] ?? 0.55;
    score += weight * value;
  }
  return Math.round(score * 1000) / 1000;
}

export function validateBalance(contribution: StructuredContribution): BalanceReport {
  const violations: BalanceViolation[] = [];
  const budget = CATEGORY_BUDGETS[contribution.category];
  const score = powerScore(contribution);

  if (score > budget) {
    violations.push({
      code: "POWER_BUDGET_EXCEEDED",
      message: `power score ${score.toFixed(2)} exceeds the ${contribution.category} budget of ${budget}`,
      severity: "nerf",
    });
  }

  for (const combo of FORBIDDEN_COMBOS) {
    const total = combo.traits.reduce((sum, t) => sum + (contribution.traits[t] ?? 0), 0);
    if (total >= combo.threshold) {
      violations.push({ code: "FORBIDDEN_COMBO", message: combo.message, severity: "nerf" });
    }
  }

  // single-trait saturation: more than two traits pinned at maximum
  const maxed = Object.values(contribution.traits).filter((v) => v >= 0.99).length;
  if (maxed > 2) {
    violations.push({
      code: "TRAIT_SATURATION",
      message: "more than two traits are at absolute maximum — nothing in nature is perfect at everything",
      severity: "nerf",
    });
  }

  if (violations.length === 0) {
    return { balanced: true, violations: [], suggested: null, powerScore: score };
  }

  return {
    balanced: false,
    violations,
    suggested: buildBalancedSuggestion(contribution, budget),
    powerScore: score,
  };
}

/** scale traits down until the addition fits its budget and combos */
export function buildBalancedSuggestion(
  contribution: StructuredContribution,
  budget: number,
): StructuredContribution {
  const traits = { ...contribution.traits };
  // first pass: uniform scale to fit the budget
  let score = powerScore({ ...contribution, traits });
  if (score > budget) {
    const factor = (budget * 0.92) / score;
    for (const key of Object.keys(traits)) {
      const weight = TRAIT_WEIGHTS[key] ?? 0.55;
      if (weight <= 0) continue; // weaknesses are not nerfed
      traits[key] = Math.round(traits[key]! * factor * 1000) / 1000;
    }
  }
  // second pass: break forbidden combos by capping the cheapest trait
  for (const combo of FORBIDDEN_COMBOS) {
    let total = combo.traits.reduce((sum, t) => sum + (traits[t] ?? 0), 0);
    while (total >= combo.threshold) {
      const weakest = combo.traits.reduce((a, b) => ((traits[a] ?? 0) <= (traits[b] ?? 0) ? a : b));
      traits[weakest] = Math.max(0.1, Math.round(((traits[weakest] ?? 0) - 0.15) * 1000) / 1000);
      total = combo.traits.reduce((sum, t) => sum + (traits[t] ?? 0), 0);
    }
  }
  return {
    ...contribution,
    description: contribution.description,
    traits,
    risks: [...contribution.risks, "auto-balanced to respect the world's power budget"],
  };
}
