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
};

const BLOCKED_PATTERNS = [
  /سلاح/i,
  /مخدر/i,
  /قمار/i,
  /weapon/i,
  /drug/i,
  /casino/i,
  /bitcoin\s*double/i,
];

const REVIEW_PATTERNS = [
  /مستعجل حول/i,
  /اربح الآن/i,
  /gratis money/i,
  /crypto giveaway/i,
];

/** Lightweight on-device/server-compatible heuristic. Heavy models can replace this later. */
export function scanAdContent(input: AiScanInput): AiScanResult {
  const text = `${input.title}\n${input.description ?? ""}\n${input.contactValue ?? ""}`;
  const reasons: string[] = [];

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) reasons.push(`blocked_pattern:${pattern.source}`);
  }
  if (reasons.length) {
    return { label: "BLOCKED", reasons, autoAction: "auto_pause" };
  }

  for (const pattern of REVIEW_PATTERNS) {
    if (pattern.test(text)) reasons.push(`review_pattern:${pattern.source}`);
  }
  if ((input.contactValue ?? "").includes("bit.ly")) {
    reasons.push("short_link");
  }

  if (reasons.length) {
    return { label: "NEEDS_REVIEW", reasons, autoAction: "flag_for_admin" };
  }

  return { label: "SAFE", reasons: [], autoAction: "keep_published" };
}
