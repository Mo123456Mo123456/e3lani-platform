/**
 * Content moderation — layered checks on user text before it reaches the
 * analyzer or the engine: prompt-injection patterns, code/SQL smuggling,
 * spam/entropy, and banned-content keywords. Verdicts are recorded for the
 * admin moderation queue.
 */
import { randomUUID } from "node:crypto";
import type { ModerationResult } from "@planet/shared-types";

const INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i, "prompt_injection"],
  [/تجاهل\s+(كل\s+)?(التعليمات|الأوامر)/, "prompt_injection"],
  [/system\s*prompt|you\s+are\s+(now\s+)?a\b/i, "prompt_injection"],
  [/\[INST\]|<<SYS>>|<\|im_start\|>/i, "prompt_injection"],
  [/\bDAN\b|jailbreak/i, "prompt_injection"],
  [/```\s*(sql|bash|sh|python|javascript|js)/i, "code_smuggling"],
  [/\b(DROP|TRUNCATE|ALTER)\s+TABLE\b|\bUNION\s+SELECT\b|\bINSERT\s+INTO\b/i, "sql_injection"],
  [/<\s*script|javascript:|on\w+\s*=/i, "xss_attempt"],
  [/\$\(|`[^`]+`|;\s*(rm|curl|wget|nc)\s/i, "shell_smuggling"],
  [/process\.env|require\(|import\s*\(/i, "code_smuggling"],
];

const BANNED_KEYWORDS: Array<[RegExp, string]> = [
  [/سلاح نووي|قنبلة ذرية|nuclear weapon|dirty bomb/i, "banned_content"],
  [/إبادة جماعية|genocide|ethnic cleansing/i, "banned_content"],
];

export interface ModerationVerdict {
  verdict: "allow" | "review" | "block";
  reasons: string[];
}

export function moderateText(text: string): ModerationVerdict {
  const reasons: string[] = [];

  if (text.trim().length < 4) reasons.push("too_short");
  if (text.length > 2000) reasons.push("too_long");

  for (const [pattern, reason] of INJECTION_PATTERNS) {
    if (pattern.test(text)) reasons.push(reason);
  }

  let banned = false;
  for (const [pattern, reason] of BANNED_KEYWORDS) {
    if (pattern.test(text)) {
      reasons.push(reason);
      banned = true;
    }
  }

  // spam: extreme character repetition or single-word flood
  if (/(.)\1{14,}/.test(text)) reasons.push("repetition_spam");
  const words = text.trim().split(/\s+/);
  if (words.length > 12 && new Set(words.map((w) => w.toLowerCase())).size <= 2) {
    reasons.push("low_entropy_spam");
  }

  const hardBlock = banned || reasons.some((r) => r === "sql_injection" || r === "xss_attempt" || r === "shell_smuggling" || r === "code_smuggling");
  const injection = reasons.includes("prompt_injection");
  if (hardBlock) return { verdict: "block", reasons };
  if (injection) return { verdict: "block", reasons };
  if (reasons.length > 0) return { verdict: "review", reasons };
  return { verdict: "allow", reasons: [] };
}

export function toModerationResult(targetId: string, verdict: ModerationVerdict): ModerationResult {
  return {
    id: randomUUID(),
    targetId,
    verdict: verdict.verdict,
    reasons: verdict.reasons,
    createdAt: new Date().toISOString(),
  };
}
