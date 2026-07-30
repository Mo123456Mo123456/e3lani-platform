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
  const raw = `${input.title} ${input.description || ''}`;
  const text = raw.toLowerCase();
  const risk = /حرب|دمار|انقراض|سم|nuke|war|extinct|immortal|لا يموت|طاقة لا محدودة/.test(text)
    ? 0.85
    : /تلوث|pollution|حرب|مرض|disease/.test(text)
      ? 0.45
      : 0.22;

  const has = (...keys: string[]) => keys.some((k) => text.includes(k));
  const traits: Record<string, number> = {
    size: has('عملاق', 'giant', 'ضخم') ? 0.85 : 0.45,
    growthRate: has('سريع', 'fast', 'ينتشر') ? 0.65 : 0.35,
    waterNeed: has('ماء', 'water', 'نهر') ? 0.7 : 0.4,
    pollutionAbsorption: has('تلوث', 'pollution', 'تمتص') ? 0.9 : 0.1,
    nightLuminosity: has('تضيء', 'ليل', 'light', 'glow') ? 0.8 : 0.05,
    coldResistance: has('برد', 'ثلج', 'cold', 'ice') ? 0.7 : 0.35,
    heatResistance: has('حر', 'صحراء', 'heat', 'desert') ? 0.7 : 0.4,
    aggression: has('عدوان', 'حرب', 'predator', 'مفترس') ? 0.7 : 0.2,
    adaptability: 0.55,
    novelty: 0.6,
    coherence: 0.75,
  };

  const possibleBiomes = has('صحراء', 'desert')
    ? ['desert', 'steppe']
    : has('قطب', 'ثلج', 'ice')
      ? ['tundra', 'ice']
      : ['tropical_forest', 'temperate_forest', 'plains'];

  const risks: string[] = [];
  if (traits.waterNeed > 0.6) risks.push('high_water_consumption');
  if (traits.pollutionAbsorption > 0.7) risks.push('ecosystem_competition');
  if (traits.growthRate > 0.6) risks.push('invasive_spread');
  if (risk > 0.7) risks.push('world_destabilization');

  return {
    type: input.type,
    title: input.title,
    traits: { ...traits, ...(input.payload || {}) },
    balanceHints:
      risk > 0.5
        ? ['خفض الأثر الأولي', 'إضافة قيود انتشار', 'ربط بسلسلة غذائية', 'اقتراح نسخة متوازنة']
        : ['متوازن نسبياً', 'يمكن الحقن مباشرة', 'مراقبة استهلاك المياه'],
    risk,
    structured: {
      category: input.type,
      name: input.title,
      traits,
      possibleBiomes,
      risks,
      tags: text.split(/\s+/).filter(Boolean).slice(0, 10),
      sandbox: true,
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
      const res = await fetch(`${base.replace(/\/$/, '')}/ai/analyze-element`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: input.type,
          title: input.title,
          description: input.description || '',
          locale: 'ar',
          traits: input.payload || {},
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const raw = (await res.json()) as Record<string, unknown>;
        const element = (raw.element || raw) as Record<string, unknown>;
        const data: AiParseResult = {
          type: String(element.category || input.type),
          title: String(element.name || input.title),
          traits: (element.traits as Record<string, unknown>) || {},
          balanceHints: (raw.balanceHints as string[]) || [],
          risk: Number(raw.risk ?? 0.3),
          structured: element,
          provider: String(raw.provider || 'orchestrator'),
        };
        await db.insert(aiRequests).values({
          id: reqId,
          userId: input.userId,
          contributionId: input.contributionId,
          provider: data.provider,
          prompt,
          response: data as unknown as Record<string, unknown>,
          status: 'ok',
          latencyMs: Date.now() - started,
        });
        return data;
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
