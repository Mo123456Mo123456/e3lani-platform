import type { NarrationFact } from "@kawkab/shared-types";

export interface GroundingReport {
  grounded: boolean;
  violations: string[];
}

const ARABIC_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };

function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d).replace(/٫/g, ".").replace(/٪/g, "%");
}

/**
 * The narrator may not invent numbers: every numeric claim in the narration
 * must appear among the simulation facts (within rounding tolerance).
 */
export function checkGrounding(narration: string, facts: NarrationFact[]): GroundingReport {
  const violations: string[] = [];
  const allowed = new Set<number>();
  for (const fact of facts) {
    if (typeof fact.value === "number") {
      allowed.add(fact.value);
      allowed.add(Math.round(fact.value));
      allowed.add(Math.round(fact.value * 10) / 10);
      allowed.add(Math.round(fact.value * 100) / 100);
      allowed.add(Math.round(fact.value * 100)); // percentages of 0..1 values
    }
  }
  const normalized = normalizeDigits(narration);
  const numbers = normalized.match(/\d+(?:\.\d+)?/g) ?? [];
  for (const n of numbers) {
    const value = parseFloat(n);
    const ok = [...allowed].some((a) => Math.abs(a - value) < 0.51 || (a !== 0 && Math.abs(a - value) / Math.abs(a) < 0.02));
    if (!ok) violations.push(`unfounded number: ${n}`);
  }
  return { grounded: violations.length === 0, violations };
}

/** deterministic template narration built ONLY from facts — always grounded */
export function templateNarration(facts: NarrationFact[], locale: "ar" | "en"): string {
  const get = (key: string) => facts.find((f) => f.key === key)?.value;
  const parts: string[] = [];
  if (locale === "ar") {
    if (get("spreadRegions") !== undefined) parts.push(`انتشر العنصر في ${get("spreadRegions")} منطقة.`);
    if (get("pollutionDeltaPct") !== undefined) parts.push(`تغير التلوث بنسبة ${get("pollutionDeltaPct")}%.`);
    if (get("civsAffected") !== undefined) parts.push(`تأثرت ${get("civsAffected")} حضارة.`);
    if (get("warsCaused") !== undefined && Number(get("warsCaused")) > 0) parts.push(`اندلعت ${get("warsCaused")} حرب مرتبطة به.`);
    if (get("extinctions") !== undefined && Number(get("extinctions")) > 0) parts.push(`انقرضت ${get("extinctions")} أنواع بسبب التحولات البيئية.`);
    if (get("populationTotal") !== undefined) parts.push(`يبلغ سكان العالم ${get("populationTotal")}.`);
    if (get("civilizationsAlive") !== undefined) parts.push(`تقوم ${get("civilizationsAlive")} حضارة.`);
    if (get("speciesAlive") !== undefined) parts.push(`تعيش ${get("speciesAlive")} نوعًا.`);
    if (get("yearsElapsed") !== undefined) parts.push(`مرّت ${get("yearsElapsed")} سنة منذ الإضافة.`);
    if (parts.length === 0) parts.push("بدأ العنصر رحلته في العالم، وستظهر آثاره مع مرور الزمن.");
  } else {
    if (get("spreadRegions") !== undefined) parts.push(`The element spread across ${get("spreadRegions")} regions.`);
    if (get("pollutionDeltaPct") !== undefined) parts.push(`Pollution changed by ${get("pollutionDeltaPct")}%.`);
    if (get("civsAffected") !== undefined) parts.push(`${get("civsAffected")} civilizations were affected.`);
    if (get("warsCaused") !== undefined && Number(get("warsCaused")) > 0) parts.push(`${get("warsCaused")} linked wars broke out.`);
    if (get("extinctions") !== undefined && Number(get("extinctions")) > 0) parts.push(`${get("extinctions")} species went extinct in the shift.`);
    if (get("populationTotal") !== undefined) parts.push(`World population reached ${get("populationTotal")}.`);
    if (get("civilizationsAlive") !== undefined) parts.push(`${get("civilizationsAlive")} civilizations stand.`);
    if (get("speciesAlive") !== undefined) parts.push(`${get("speciesAlive")} species are alive.`);
    if (get("yearsElapsed") !== undefined) parts.push(`${get("yearsElapsed")} years have passed since the addition.`);
    if (parts.length === 0) parts.push("The element has begun its journey; its effects will unfold over time.");
  }
  return parts.join(" ");
}
