export type AiSafetyLabel = "SAFE" | "NEEDS_REVIEW" | "BLOCKED";

export type AiScanInput = {
  title: string;
  description?: string;
  contactValue?: string;
  mediaKind?: "image" | "video";
  /** Optional prior titles/descriptions from the same owner for near-duplicate checks. */
  recentOwnerTexts?: string[];
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
  { pattern: /وثائق?\s+مزوّ?رة|جواز\s+سفر\s+مزوّ?ر/i, reason: "forged_docs", confidence: 0.94 },
];

const REVIEW_PHRASES: { pattern: RegExp; reason: string; confidence: number }[] = [
  { pattern: /حوّل الآن|حول الآن.*مستعجل/i, reason: "urgent_transfer", confidence: 0.7 },
  { pattern: /اربح الآن دون جهد/i, reason: "get_rich", confidence: 0.65 },
  { pattern: /crypto giveaway|gratis money/i, reason: "giveaway_spam", confidence: 0.7 },
  { pattern: /whatsapp\s*\+\d{8,}/i, reason: "whatsapp_spam_pattern", confidence: 0.55 },
];

const SHORT_LINK_HOSTS = /(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rb\.gy)/i;
const SUSPICIOUS_URL = /https?:\/\/[^\s]+/gi;
const HIGH_CONFIDENCE_PAUSE = 0.85;

function normalizeForDup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeForDup(text).split(" ").filter((token) => token.length > 2));
}

/** Jaccard similarity over tokens — flags near-duplicates without ML. */
export function textSimilarity(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
}

/**
 * Lightweight heuristic compatible with on-device/server use.
 * Image/video frame models are intentionally out of scope — hooks stay text/link based.
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

  const contact = input.contactValue ?? "";
  if (SHORT_LINK_HOSTS.test(contact) || SHORT_LINK_HOSTS.test(text)) {
    reasons.push("short_link");
    maxReview = Math.max(maxReview, 0.6);
  }

  const urls = text.match(SUSPICIOUS_URL) ?? [];
  if (urls.length >= 3) {
    reasons.push("many_links");
    maxReview = Math.max(maxReview, 0.62);
  }

  if (input.mediaKind === "video" && (input.description ?? "").length < 10) {
    reasons.push("thin_video_copy");
    maxReview = Math.max(maxReview, 0.5);
  }

  const blob = `${input.title}\n${input.description ?? ""}`;
  for (const prior of input.recentOwnerTexts ?? []) {
    if (textSimilarity(blob, prior) >= 0.92) {
      reasons.push("near_duplicate");
      maxReview = Math.max(maxReview, 0.68);
      break;
    }
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

/** Placeholder for a future vision/moderation provider — returns null until configured. */
export async function scanMediaWithProvider(_input: {
  mediaUrl: string;
  mediaKind: "image" | "video";
}): Promise<AiScanResult | null> {
  return null;
}
