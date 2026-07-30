import { BALANCE_LIMITS } from "@planet-born/config";
import type { StructuredContribution, TraitMap } from "@planet-born/shared-types";
import { clamp } from "./rng.js";

const GOD_TRAITS = [
  "immortality",
  "unlimitedEnergy",
  "instantDestruction",
  "absoluteControl",
  "infiniteReproduction",
];

/**
 * Balance layer: clamp overpowered traits and rewrite god-mode concepts.
 * Never silently accepts planet-breaking contributions.
 */
export function balanceContribution(
  input: StructuredContribution,
): StructuredContribution {
  const notes: string[] = [];
  const traits: TraitMap = { ...input.traits };
  let wasBalanced = false;

  for (const [key, value] of Object.entries(traits)) {
    if (value > BALANCE_LIMITS.maxTrait) {
      traits[key] = BALANCE_LIMITS.maxTrait;
      notes.push(`خُفّضت خاصية ${key} إلى الحد الآمن`);
      wasBalanced = true;
    }
  }

  if ((traits.reproductionRate ?? 0) > BALANCE_LIMITS.maxReproduction) {
    traits.reproductionRate = BALANCE_LIMITS.maxReproduction;
    notes.push("معدل التكاثر خُفّض لمنع الانفجار السكاني");
    wasBalanced = true;
  }

  if ((traits.immortality ?? 0) > 0) {
    traits.lifespan = Math.max(traits.lifespan ?? 0.7, 0.85);
    delete traits.immortality;
    notes.push("استُبدلت خاصية الخلود بعمر طويل محدود");
    wasBalanced = true;
  }

  if ((traits.unlimitedEnergy ?? 0) > 0 || (traits.energyOutput ?? 0) > BALANCE_LIMITS.maxUnlimitedEnergy) {
    traits.energyOutput = BALANCE_LIMITS.maxUnlimitedEnergy;
    delete traits.unlimitedEnergy;
    notes.push("الطاقة غير المحدودة حُوّلت إلى إنتاج مرتفع محدود بموارد");
    wasBalanced = true;
  }

  if ((traits.instantDestruction ?? 0) > BALANCE_LIMITS.maxInstantDestruction) {
    traits.instantDestruction = BALANCE_LIMITS.maxInstantDestruction;
    traits.environmentalImpact = clamp((traits.environmentalImpact ?? 0.5) + 0.2, 0, 0.95);
    notes.push("قوة التدمير الفوري رُفضت؛ استُبدلت بأثر كارثي محدود");
    wasBalanced = true;
  }

  if ((traits.absoluteControl ?? 0) > 0) {
    delete traits.absoluteControl;
    traits.influence = 0.55;
    notes.push("السيطرة المطلقة غير مسموحة؛ مُنحت قدرة تأثير محدودة");
    wasBalanced = true;
  }

  for (const g of GOD_TRAITS) {
    if (g in traits && (traits[g] ?? 0) >= 0.99) {
      traits[g] = 0.5;
      wasBalanced = true;
      notes.push(`أُعيد توازن الخاصية الخارقة: ${g}`);
    }
  }

  const risks = [...input.risks];
  if (wasBalanced && !risks.includes("balance_adjustment")) {
    risks.push("balance_adjustment");
  }

  const balanceScore = clamp(
    1 -
      Object.values(traits).reduce((a, v) => a + Math.max(0, v - 0.7), 0) / 10 -
      (wasBalanced ? 0.1 : 0),
    0,
    1,
  );

  return {
    ...input,
    traits,
    risks,
    wasBalanced,
    balanceNotes: notes,
    balanceScore,
  };
}
