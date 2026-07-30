/**
 * Content moderation: static rules first (fast, deterministic), then an
 * optional AI classification pass. Guards against abuse, banned content,
 * prompt injection and attempts to smuggle code into the world.
 */

export interface ModerationResult {
  allowed: boolean;
  flags: string[];
  score: number; // 0 clean .. 1 blocked
}

const INJECTION_PATTERNS = [
  /ignore (all|previous) instructions/i,
  /system prompt|system_prompt/i,
  /تجاهل التعليمات|تجاهل كل الأوامر/i,
  /\bDROP TABLE\b|\bDELETE FROM\b|\bINSERT INTO\b/i,
  /<\s*script/i,
  /\$\{.*\}/,
  /process\.env|require\(|import\s*\(/i,
  /```\s*(bash|sh|python|sql|js|javascript)/i,
];

const ABUSE_PATTERNS = [
  /نازي|هتلر|nazi|hitler/i,
  /إبادة|genocide of|exterminate all (humans|people)/i,
];

const MAX_LEN = 2000;
const recentHashes = new Map<string, number>(); // text hash -> count (rate of duplicates)

export function moderateText(text: string, userId: string): ModerationResult {
  const flags: string[] = [];

  if (text.length < 4) flags.push("too_short");
  if (text.length > MAX_LEN) flags.push("too_long");

  for (const p of INJECTION_PATTERNS) {
    if (p.test(text)) {
      flags.push("prompt_injection");
      break;
    }
  }
  for (const p of ABUSE_PATTERNS) {
    if (p.test(text)) {
      flags.push("abuse_content");
      break;
    }
  }

  const key = `${userId}:${simpleHash(text)}`;
  const seen = (recentHashes.get(key) ?? 0) + 1;
  recentHashes.set(key, seen);
  if (recentHashes.size > 10000) recentHashes.clear();
  if (seen > 3) flags.push("duplicate_spam");

  const blocking = flags.includes("prompt_injection") || flags.includes("abuse_content") || flags.includes("duplicate_spam");
  const score = blocking ? 1 : flags.length > 0 ? 0.6 : 0;
  return { allowed: score < 1 && !flags.includes("too_long") && !flags.includes("too_short"), flags, score };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h.toString(36);
}
