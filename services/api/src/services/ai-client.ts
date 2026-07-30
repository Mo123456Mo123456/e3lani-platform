import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';
import { aiRequests } from '../db/schema.js';

export type AiParseResult = {
  type: string;
  title: string;
  traits: Record<string, unknown>;
  balanceHints: string[];
  risk: number;
  structured: Record<string, unknown>;
  provider: string;
};

function localMockParse(input: {
  type: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
}): AiParseResult {
  const text = `${input.title} ${input.description || ''}`.toLowerCase();
  const risk = /حرب|دمار|انقراض|سم|nuke|war|extinct/.test(text) ? 0.8 : 0.2;
  return {
    type: input.type,
    title: input.title,
    traits: {
      novelty: 0.5,
      coherence: 0.7,
      ...(input.payload || {}),
    },
    balanceHints:
      risk > 0.5
        ? ['خفض الأثر الأولي', 'إضافة قيود انتشار', 'ربط بسلسلة غذائية']
        : ['متوازن نسبياً', 'يمكن الحقن مباشرة'],
    risk,
    structured: {
      entityType: input.type,
      name: input.title,
      tags: text.split(/\s+/).filter(Boolean).slice(0, 8),
    },
    provider: 'local-mock',
  };
}

export async function analyzeContribution(input: {
  userId?: string;
  contributionId?: string;
  type: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
}): Promise<AiParseResult> {
  const db = getDb();
  const prompt = JSON.stringify({
    type: input.type,
    title: input.title,
    description: input.description,
    payload: input.payload,
  });
  const reqId = nanoid();
  const started = Date.now();

  const base = process.env.AI_ORCHESTRATOR_URL;
  if (base) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: prompt,
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as AiParseResult;
        await db.insert(aiRequests).values({
          id: reqId,
          userId: input.userId,
          contributionId: input.contributionId,
          provider: data.provider || 'orchestrator',
          prompt,
          response: data as unknown as Record<string, unknown>,
          status: 'ok',
          latencyMs: Date.now() - started,
        });
        return { ...data, provider: data.provider || 'orchestrator' };
      }
    } catch {
      // fall through to mock
    }
  }

  const result = localMockParse(input);
  await db.insert(aiRequests).values({
    id: reqId,
    userId: input.userId,
    contributionId: input.contributionId,
    provider: 'local-mock',
    prompt,
    response: result as unknown as Record<string, unknown>,
    status: 'ok',
    latencyMs: Date.now() - started,
  });
  return result;
}
