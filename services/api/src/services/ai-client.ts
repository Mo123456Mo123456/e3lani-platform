import type { StructuredElement } from "@planet/shared-types";
import type { SimEvent } from "@planet/simulation-core";

/** Narrative strictly from structured facts — no invented events */
export function narrateFromFacts(
  element: StructuredElement,
  events: SimEvent[],
): { en: string; ar: string } {
  const traits = Object.entries(element.traits)
    .filter(([, v]) => v >= 0.5)
    .map(([k, v]) => `${k}=${v.toFixed(2)}`)
    .join(", ");
  const biomes = element.possibleBiomes.join(", ");
  const risks = element.risks.length ? element.risks.join(", ") : "none flagged";
  const eventBits = events
    .filter((e) => e.type !== "USER_CONTRIBUTION")
    .map((e) => e.title)
    .slice(0, 5);

  const en = [
    `${element.name} (${element.category}) is structured with traits [${traits || "baseline"}].`,
    `Suitable biomes: ${biomes}.`,
    `Risks: ${risks}.`,
    element.balanceNotes.length
      ? `Balance adjustments applied: ${element.balanceNotes.join("; ")}.`
      : `Balance check passed.`,
    eventBits.length
      ? `Simulation facts: ${eventBits.join("; ")}.`
      : `Awaiting world commitment for further causal effects.`,
  ].join(" ");

  const ar = [
    `${element.nameAr ?? element.name} (${element.category}) بخصائص [${traits || "أساسية"}].`,
    `البيئات المناسبة: ${biomes}.`,
    `المخاطر: ${element.risks.length ? element.risks.join("، ") : "لا توجد إشارة"}.`,
    element.balanceNotes.length
      ? `تعديلات توازن: ${element.balanceNotes.join("؛ ")}.`
      : `اجتاز فحص التوازن.`,
    eventBits.length
      ? `حقائق المحاكاة: ${eventBits.join("؛ ")}.`
      : `بانتظار الإدخال إلى العالم لمزيد من الآثار السببية.`,
  ].join(" ");

  return { en, ar };
}

export async function callAiOrchestrator(input: {
  text: string;
  category?: string;
  locale: string;
}): Promise<{
  structured: StructuredElement;
  narrative: string;
  narrativeAr: string;
  provider: string;
}> {
  const base = process.env.AI_ORCHESTRATOR_URL ?? "http://localhost:8002";
  const res = await fetch(`${base}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`AI orchestrator ${res.status}`);
  return res.json() as Promise<{
    structured: StructuredElement;
    narrative: string;
    narrativeAr: string;
    provider: string;
  }>;
}
