import type { BalanceIssue, BalanceResult, ParsedContribution } from "@kawkab/shared-types";
import { SIMULATION_DEFAULTS } from "@kawkab/config";

const CAP = SIMULATION_DEFAULTS.traitCap;
const BUDGET = SIMULATION_DEFAULTS.traitBudget;

/**
 * The balance layer: nothing enters the world that breaks it.
 * Instead of hard-rejecting overpowered ideas we return a balanced variant
 * plus an explanation of every adjustment.
 */
export function checkBalance(parsed: ParsedContribution): BalanceResult {
  const issues: BalanceIssue[] = [];
  const adjustments: string[] = [];
  const adjusted: ParsedContribution = structuredClone(parsed);
  const t = adjusted.traits;

  const entries = Object.entries(t).filter(([, v]) => v !== undefined) as Array<[string, number]>;
  if (entries.length === 0) {
    issues.push({ code: "EMPTY_TRAITS", message: "No measurable traits were detected." });
  }

  // single-trait caps — nothing is perfect
  for (const [key, value] of entries) {
    if (key.endsWith("Multiplier")) {
      if (value > 3 || value < 0.2) {
        const clamped = Math.max(0.2, Math.min(3, value));
        t[key] = clamped;
        issues.push({ code: "TRAIT_OVER_CAP", message: `${key} clamped to ${clamped}.`, trait: key });
        adjustments.push(`${key}: ${value} → ${clamped}`);
      }
      continue;
    }
    if (value > CAP) {
      t[key] = CAP;
      issues.push({ code: "TRAIT_OVER_CAP", message: `${key} capped at ${CAP}.`, trait: key });
      adjustments.push(`${key}: ${value} → ${CAP}`);
    }
  }

  // forbidden combinations (applied BEFORE the budget so fixes can't re-inflate)
  const near = (v: number | undefined, threshold = 0.9) => (v ?? 0) >= threshold;
  if (near(t.lifespan, 0.98) && near(t.reproductionRate)) {
    t.lifespan = 0.9;
    t.reproductionRate = Math.min(t.reproductionRate ?? 0.5, 0.7);
    issues.push({ code: "IMMORTALITY", message: "Immortal fast-breeding life is impossible; mortality restored." });
    adjustments.push("lifespan ≤0.9, reproductionRate ≤0.7");
  }
  if (near(t.toxicity, 0.9) && near(t.spreadRate) && near(t.lethality ?? 0, 0.85)) {
    t.spreadRate = 0.5;
    t.lethality = 0.6;
    issues.push({ code: "INSTANT_PLANET_KILL", message: "A world-ending plague is not permitted; virulence reduced." });
    adjustments.push("spreadRate → 0.5, lethality → 0.6");
  }
  if (near(t.energyOutput, 0.95) && near(t.renewalRate, 0.95)) {
    t.energyOutput = 0.85;
    issues.push({ code: "UNBOUNDED_ENERGY", message: "Unlimited free energy breaks the economy; output bounded." });
    adjustments.push("energyOutput → 0.85");
  }
  if (near(t.influence, 0.95) && near(t.intelligence, 0.95) && parsed.category === "culture") {
    t.influence = 0.8;
    issues.push({ code: "ABSOLUTE_CONTROL", message: "No idea may grant absolute control; influence reduced." });
    adjustments.push("influence → 0.8");
  }
  if (parsed.category === "custom" && entries.length < 2) {
    issues.push({ code: "EMPTY_TRAITS", message: "Custom elements need at least two traits to be simulated." });
  }

  // total power budget
  const budgetKeys = entries.filter(([k]) => !k.endsWith("Multiplier"));
  const currentSum = budgetKeys.reduce((s, [k]) => s + (t[k] ?? 0), 0);
  if (currentSum > BUDGET) {
    const scale = BUDGET / currentSum;
    for (const [k] of budgetKeys) t[k] = Math.round((t[k] ?? 0) * scale * 100) / 100;
    issues.push({ code: "TRAIT_BUDGET_EXCEEDED", message: `Trait budget ${currentSum.toFixed(2)} exceeded ${BUDGET}; scaled to fit.` });
    adjustments.push(`all traits scaled ×${scale.toFixed(2)}`);
  }

  const hardReject = issues.some((i) => i.code === "EMPTY_TRAITS");
  return { acceptable: !hardReject, issues, adjusted, adjustments };
}

/** quick factual summary of what a balanced element will do (pre-simulation preview) */
export function expectedEffects(parsed: ParsedContribution): { shortTerm: string[]; longTerm: string[] } {
  const t = parsed.traits;
  const shortTerm: string[] = [];
  const longTerm: string[] = [];
  if ((t.pollutionAbsorption ?? 0) > 0.4) {
    shortTerm.push("local pollution will start falling");
    longTerm.push("nearby cities gain health; industrial growth accelerates");
  }
  if ((t.waterNeed ?? 0) > 0.6) {
    shortTerm.push("high water consumption may stress rivers");
    longTerm.push("possible conflicts over water between neighbouring peoples");
  }
  if ((t.energyStorage ?? 0) > 0.5 || (t.energyOutput ?? 0) > 0.5) {
    shortTerm.push("settlements nearby gain an energy advantage");
    longTerm.push("new industries may emerge; struggles over growing zones likely");
  }
  if ((t.aggression ?? 0) > 0.6) {
    shortTerm.push("predation pressure on local species");
    longTerm.push("food-web shifts and possible extinctions");
  }
  if ((t.spreadRate ?? 0) > 0.6 || (t.reproductionRate ?? 0) > 0.6) {
    shortTerm.push("rapid colonisation of suitable habitats");
    longTerm.push("competition with native species; ecosystem rebalancing");
  }
  if (parsed.category === "world_law") {
    shortTerm.push("the rules of the world shift immediately");
    longTerm.push("every civilization's decisions are affected for millennia");
  }
  if (shortTerm.length === 0) shortTerm.push("subtle local effects around the origin region");
  if (longTerm.length === 0) longTerm.push("slow integration into the world's causal web");
  return { shortTerm, longTerm };
}
