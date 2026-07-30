/**
 * Prompt-injection defense: user text is DATA, never instructions.
 * - hard length cap
 * - strip control chars & zero-width tricks
 * - neutralise common override phrases (they stay visible as literal text)
 */
const OVERRIDE_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi,
  /تجاهل\s+(كل\s+)?(التعليمات|الأوامر)(\s+السابقة)?/g,
  /system\s*:\s*/gi,
  /\[INST\]/g,
  /<<\s*SYS\s*>>/g,
  /you\s+are\s+now\s+/gi,
  /new\s+instructions?\s*:/gi,
  /forget\s+(everything|all)/gi,
  /انسَ\s+كل\s+شيء/g,
];

export function sanitizeUserText(raw: string, maxLength = 4000): string {
  let text = raw.slice(0, maxLength);
  // control characters except newline/tab
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  // zero-width & bidi override characters
  text = text.replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, "");
  for (const pattern of OVERRIDE_PATTERNS) {
    text = text.replace(pattern, (m) => `‹${m}›`);
  }
  return text.trim();
}

/** wraps user content so providers treat it strictly as data */
export function asDataBlock(text: string): string {
  return `<user_idea>\n${text}\n</user_idea>`;
}

export function detectInjection(raw: string): string[] {
  const hits: string[] = [];
  for (const pattern of OVERRIDE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(raw)) hits.push(`injection_pattern:${pattern.source.slice(0, 40)}`);
  }
  if (/DROP\s+TABLE|DELETE\s+FROM|SELECT\s+.+\s+FROM/i.test(raw)) hits.push("sql_like_content");
  if (/\{\s*\$[a-z]+\s*:/i.test(raw)) hits.push("nosql_operator_content");
  if (/```(bash|sh|python|js|sql)/i.test(raw)) hits.push("code_block_content");
  return hits;
}
