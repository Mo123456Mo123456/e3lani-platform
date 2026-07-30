import type { StructuredContribution } from "@planet/shared-types";

const FORBIDDEN_PATTERNS = [
  /لا يموت|لا تموت|immortal|invincible/i,
  /طاقة غير محدودة|unlimited energy/i,
  /سيطرة مطلقة|absolute control/i,
  /يدمر الكوكب|destroy the planet/i,
  /بلا حدود|infinite/i,
  /يلغي جميع القوانين|ignore all laws/i,
];

export function balanceContribution(
  input: StructuredContribution,
): StructuredContribution {
  const traits = { ...input.traits };
  const balanceNotes = [...input.balanceNotes];
  let wasBalanced = input.wasBalanced;

  const text = `${input.name} ${input.description} ${input.originalIdea}`;
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      wasBalanced = true;
      balanceNotes.push(
        "تم تعديل العنصر ليتوافق مع قوانين العالم (منع الخصائص الخارقة).",
      );
    }
  }

  for (const [key, value] of Object.entries(traits)) {
    if (value > 0.85) {
      traits[key] = 0.85;
      wasBalanced = true;
      balanceNotes.push(`خُفّضت الخاصية ${key} إلى 0.85 للتوازن.`);
    }
  }

  if ((traits.reproduction ?? 0) > 0.8 && (traits.size ?? 0) > 0.8) {
    traits.reproduction = 0.45;
    wasBalanced = true;
    balanceNotes.push("خُفّض معدل التكاثر لتفادي النمو غير المحدود.");
  }

  if ((traits.pollutionAbsorption ?? 0) > 0.9) {
    traits.waterNeed = Math.max(traits.waterNeed ?? 0.5, 0.7);
    balanceNotes.push("الامتصاص العالي للتلوث يتطلب استهلاك مياه مرتفع.");
    wasBalanced = true;
  }

  const risks = new Set(input.risks);
  if ((traits.waterNeed ?? 0) > 0.65) risks.add("high_water_consumption");
  if ((traits.aggression ?? 0) > 0.7) risks.add("conflict_risk");
  if ((traits.pollutionAbsorption ?? 0) < 0.1 && input.category === "technology") {
    risks.add("pollution_increase");
  }

  return {
    ...input,
    traits,
    risks: [...risks],
    balanceNotes,
    wasBalanced,
  };
}

export function isForbiddenIdea(idea: string): boolean {
  return FORBIDDEN_PATTERNS.some((p) => p.test(idea));
}
