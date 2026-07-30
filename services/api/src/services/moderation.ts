const BLOCKED = [
  /drop\s+table/i,
  /;\s*--/,
  /<\/?script/i,
  /system\(/i,
  /eval\(/i,
  /__proto__/i,
  /ignore previous instructions/i,
  /jailbreak/i,
  /sudo\s+/i,
];

export function moderateContent(content: string): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const pattern of BLOCKED) {
    if (pattern.test(content)) reasons.push(`blocked_pattern:${pattern}`);
  }
  if (content.length > 2000) reasons.push("too_long");
  return { allowed: reasons.length === 0, reasons };
}
