export type AiSafetyLabel = "SAFE" | "NEEDS_REVIEW" | "BLOCKED";

export type AiScanInput = {
  title: string;
  description?: string;
  contactValue?: string;
  mediaKind?: "image" | "video";
};

export type AiScanResult = {
  label: AiSafetyLabel;
  reasons: string[];
  autoAction: "keep_published" | "flag_for_admin" | "auto_pause";
  confidence: number;
};

/** Phrase-level blocks — avoid pausing on a lone ambiguous word without context. */
const BLOCKED_PHRASES: { pattern: RegExp; reason: string; confidence: number }[] = [
  { pattern: /بيع\s+سلاح(?:\s+ناري)?/i, reason: "weapons_sale", confidence: 0.95 },
  { pattern: /سلاح\s+ناري/i, reason: "firearm", confidence: 0.92 },
  { pattern: /مخدرات|حشيش|كوكايين/i, reason: "drugs", confidence: 0.95 },
  { pattern: /\b(buy|sell)\s+(guns?|weapons?)\b/i, reason: "weapons_en", confidence: 0.93 },
  { pattern: /\b(cocaine|heroin|meth)\b/i, reason: "drugs_en", confidence: 0.95 },
  { pattern: /قمار\s+أون\s*لاين|كازينو\s+للربح/i, reason: "gambling", confidence: 0.9 },
  { pattern: /bitcoin\s*double|ضاعف\s+بيتكوين/i, reason: "crypto_scam", confidence: 0.92 },
];

const REVIEW_PHRASES: { pattern: RegExp; reason: string; confidence: number }[] = [
  { pattern: /حوّل الآن|حول الآن.*مستعجل/i, reason: "urgent_transfer", confidence: 0.7 },
  { pattern: /اربح الآن دون جهد/i, reason: "get_rich", confidence: 0.65 },
  { pattern: /crypto giveaway|gratis money/i, reason: "giveaway_spam", confidence: 0.7 },
];

const HIGH_CONFIDENCE_PAUSE = 0.85;

/**
 * Lightweight heuristic compatible with on-device/server use.
 * Single ambiguous words (e.g. "سلاح" alone in a legal/news context) do not auto-pause.
 */
export function scanAdContent(input: AiScanInput): AiScanResult {
  const text = `${input.title}\n${input.description ?? ""}\n${input.contactValue ?? ""}`.trim();
  const reasons: string[] = [];
  let maxBlocked = 0;
  let maxReview = 0;

  for (const rule of BLOCKED_PHRASES) {
    if (rule.pattern.test(text)) {
      reasons.push(rule.reason);
      maxBlocked = Math.max(maxBlocked, rule.confidence);
    }
  }

  if (maxBlocked >= HIGH_CONFIDENCE_PAUSE) {
    return {
      label: "BLOCKED",
      reasons,
      autoAction: "auto_pause",
      confidence: maxBlocked,
    };
  }

  if (maxBlocked > 0) {
    return {
      label: "NEEDS_REVIEW",
      reasons,
      autoAction: "flag_for_admin",
      confidence: maxBlocked,
    };
  }

  for (const rule of REVIEW_PHRASES) {
    if (rule.pattern.test(text)) {
      reasons.push(rule.reason);
      maxReview = Math.max(maxReview, rule.confidence);
    }
  }
  if ((input.contactValue ?? "").includes("bit.ly")) {
    reasons.push("short_link");
    maxReview = Math.max(maxReview, 0.6);
  }

  if (reasons.length) {
    return {
      label: "NEEDS_REVIEW",
      reasons,
      autoAction: "flag_for_admin",
      confidence: maxReview || 0.55,
    };
  }

  return { label: "SAFE", reasons: [], autoAction: "keep_published", confidence: 0.2 };
}
