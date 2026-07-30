/**
 * Balance user-submitted elements — clamp overpowered traits.
 */

export interface ElementTraits {
  [key: string]: unknown;
  immortality?: boolean;
  infiniteEnergy?: boolean;
  invincible?: boolean;
  omnipotent?: boolean;
  strength?: number;
  intelligence?: number;
  reproductionRate?: number;
  lifespan?: number;
  size?: number;
  aggression?: number;
  adaptability?: number;
  lethality?: number;
  infectivity?: number;
  abundance?: number;
  renewability?: number;
  militaryPower?: number;
  techLevel?: number;
  growthRate?: number;
}

export interface BalanceResult {
  balanced: ElementTraits;
  warnings: string[];
  rejected: boolean;
  alternatives: string[];
}

const CLAMP_01 = (v: number, max = 1) => Math.min(max, Math.max(0, v));

export function balanceUserElement(traits: ElementTraits): BalanceResult {
  const balanced: ElementTraits = { ...traits };
  const warnings: string[] = [];
  const alternatives: string[] = [];
  let rejected = false;

  if (traits.immortality === true) {
    rejected = true;
    delete balanced.immortality;
    balanced.lifespan = 0.95;
    warnings.push("Immortality is not allowed; converted to very long lifespan.");
    alternatives.push("Long-lived species with slow aging (lifespan ≈ 0.95)");
  }

  if (traits.infiniteEnergy === true) {
    rejected = true;
    delete balanced.infiniteEnergy;
    balanced.renewability = 0.85;
    warnings.push("Infinite energy rejected; using high renewability instead.");
    alternatives.push("Highly renewable energy resource (renewability ≈ 0.85)");
  }

  if (traits.invincible === true || traits.omnipotent === true) {
    rejected = true;
    delete balanced.invincible;
    delete balanced.omnipotent;
    balanced.strength = 0.85;
    balanced.adaptability = 0.8;
    warnings.push("Invincibility/omnipotence rejected; capped combat and adaptation traits.");
    alternatives.push("Resilient apex traits with natural predators and carrying limits");
  }

  const numericCaps: Array<[keyof ElementTraits, number, number]> = [
    ["strength", 0.9, 0.9],
    ["intelligence", 0.92, 0.92],
    ["reproductionRate", 0.85, 0.85],
    ["lifespan", 0.95, 0.95],
    ["size", 0.95, 0.95],
    ["aggression", 0.9, 0.9],
    ["adaptability", 0.9, 0.9],
    ["lethality", 0.7, 0.7],
    ["infectivity", 0.75, 0.75],
    ["abundance", 0.9, 0.9],
    ["renewability", 0.9, 0.9],
    ["militaryPower", 0.85, 0.85],
    ["techLevel", 0.9, 0.9],
    ["growthRate", 0.8, 0.8],
  ];

  for (const [key, softMax] of numericCaps) {
    const raw = balanced[key];
    if (typeof raw !== "number") continue;
    if (raw > softMax) {
      warnings.push(`${String(key)} capped from ${raw} to ${softMax}`);
      (balanced as Record<string, unknown>)[key as string] = softMax;
    } else if (raw < 0) {
      (balanced as Record<string, unknown>)[key as string] = 0;
      warnings.push(`${String(key)} raised from ${raw} to 0`);
    } else {
      (balanced as Record<string, unknown>)[key as string] = CLAMP_01(raw, softMax);
    }
  }

  // Combo checks: hyper-lethal pandemic
  const leth = typeof balanced.lethality === "number" ? balanced.lethality : 0;
  const inf = typeof balanced.infectivity === "number" ? balanced.infectivity : 0;
  if (leth * inf > 0.45) {
    balanced.lethality = Math.min(leth, 0.55);
    balanced.infectivity = Math.min(inf, 0.6);
    warnings.push("Disease lethality×infectivity product limited for planetary stability.");
    alternatives.push("High infectivity with low lethality, or localized high lethality");
    rejected = true;
  }

  // Apex predator that also reproduces extremely fast
  const str = typeof balanced.strength === "number" ? balanced.strength : 0;
  const repro = typeof balanced.reproductionRate === "number" ? balanced.reproductionRate : 0;
  if (str > 0.8 && repro > 0.7) {
    balanced.reproductionRate = 0.45;
    warnings.push("Strong species cannot also reproduce extremely quickly.");
    alternatives.push("K-selected apex (high strength, low reproduction)");
    rejected = true;
  }

  return { balanced, warnings, rejected, alternatives };
}
