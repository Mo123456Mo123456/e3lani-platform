import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';
import { moderationResults } from '../db/schema.js';

const BLOCKED = [/porn/i, /hate\s*speech/i, /إباحي/, /خطاب\s*كراهية/];

export type ModerationOutcome = {
  status: 'approved' | 'rejected' | 'flagged';
  reasons: string[];
  score: number;
};

export function moderateText(text: string): ModerationOutcome {
  const reasons: string[] = [];
  for (const re of BLOCKED) {
    if (re.test(text)) reasons.push(`blocked_pattern:${re.source}`);
  }
  if (text.trim().length < 2) reasons.push('too_short');
  if (text.length > 5000) reasons.push('too_long');

  if (reasons.some((r) => r.startsWith('blocked_pattern'))) {
    return { status: 'rejected', reasons, score: 0 };
  }
  if (reasons.length) {
    return { status: 'flagged', reasons, score: 0.4 };
  }
  return { status: 'approved', reasons: [], score: 1 };
}

export async function moderateContribution(contributionId: string, text: string) {
  const outcome = moderateText(text);
  const db = getDb();
  await db.insert(moderationResults).values({
    id: nanoid(),
    contributionId,
    status: outcome.status,
    reasons: outcome.reasons,
    score: outcome.score,
  });
  return outcome;
}
