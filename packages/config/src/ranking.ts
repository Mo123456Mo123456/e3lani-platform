/**
 * رياضيات الترتيب — دوال خالصة بلا أي اعتماد على قاعدة بيانات أو شبكة أو مزوّد خارجي،
 * حتى تكون قابلة للاختبار والتفسير بالكامل.
 *
 * الفلسفة: الترتيب يجب أن يكون قابلًا للشرح. كل درجة نهائية = مجموع مركّبات
 * معروفة بأوزان مضبوطة من لوحة الإدارة، لا صندوق أسود.
 */

export interface RankingWeights {
  quality: number;
  affinity: number;
  geo: number;
  freshness: number;
  promoted: number;
  seenPenalty: number;
  freshnessHalfLifeHours: number;
  /** أقصى عدد إعلانات لمعلن واحد داخل نافذة العرض */
  maxAdsPerAdvertiser: number;
  /** مدة تثبيت قائمة الترتيب لجلسة التصفح (ثوانٍ) */
  sessionTtlSeconds: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  quality: 1,
  affinity: 1.2,
  geo: 0.8,
  freshness: 1,
  promoted: 0.6,
  seenPenalty: 1.5,
  freshnessHalfLifeHours: 72,
  maxAdsPerAdvertiser: 3,
  sessionTtlSeconds: 900,
};

/**
 * الحد الأدنى لفترة ثقة ويلسون.
 *
 * لماذا لا نستخدم النسبة المباشرة (نقرات ÷ ظهور)؟
 * لأن إعلانًا ظهر مرة واحدة ونُقر عليه مرة يعطي نسبة ١٠٠٪ ويتصدّر الموجز ظلمًا.
 * ويلسون يعاقب العيّنات الصغيرة تلقائيًا: كلما قلّت البيانات اقتربت الدرجة من الصفر.
 */
export function wilsonLowerBound(successes: number, trials: number, z = 1.96): number {
  if (trials <= 0 || successes < 0) return 0;
  const clamped = Math.min(successes, trials);
  const p = clamped / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return Math.max(0, (centre - margin) / denominator);
}

export interface AdSignals {
  impressions: number;
  clicks: number;
  saves: number;
  videoViews: number;
  completions: number;
}

/**
 * درجة جودة الإعلان (٠ إلى ١): مزيج من معدّل النقر ومعدّل الحفظ ونسبة إكمال الفيديو،
 * كلها محسوبة بحدّ ويلسون الأدنى حتى لا تخدعنا العيّنات الصغيرة.
 */
export function qualityScore(signals: AdSignals): number {
  const clickRate = wilsonLowerBound(signals.clicks, signals.impressions);
  const saveRate = wilsonLowerBound(signals.saves, signals.impressions);
  const completionRate = wilsonLowerBound(signals.completions, signals.videoViews);

  // النقر أقوى إشارة نية، ثم الحفظ، ثم إكمال المشاهدة
  return clamp01(0.5 * clickRate + 0.3 * saveRate + 0.2 * completionRate);
}

/** تحلّل أُسّي للحداثة: يصل إلى ٠٫٥ عند عمر يساوي نصف العمر. */
export function freshnessDecay(ageHours: number, halfLifeHours: number): number {
  if (halfLifeHours <= 0) return 0;
  const age = Math.max(0, ageHours);
  return 2 ** (-age / halfLifeHours);
}

/** القرب الجغرافي: نفس المدينة ١، نفس المنطقة ٠٫٦، على مستوى المملكة ٠٫٣. */
export function geoScore(input: {
  sameCity: boolean;
  sameRegion: boolean;
  kingdomWide: boolean;
}): number {
  if (input.sameCity) return 1;
  if (input.sameRegion) return 0.6;
  if (input.kingdomWide) return 0.3;
  return 0;
}

/**
 * تقارب المستخدم مع قسم معيّن (٠ إلى ١).
 * يعتمد على تفاعلاته السابقة: النقر أثقل من الحفظ، والحفظ أثقل من مجرد الظهور.
 */
export function affinityScore(input: {
  categoryClicks: number;
  categorySaves: number;
  categoryImpressions: number;
  totalClicks: number;
  totalSaves: number;
  totalImpressions: number;
}): number {
  const weighted =
    3 * input.categoryClicks + 2 * input.categorySaves + 0.2 * input.categoryImpressions;
  const total = 3 * input.totalClicks + 2 * input.totalSaves + 0.2 * input.totalImpressions;
  if (total <= 0) return 0;
  return clamp01(weighted / total);
}

export interface ScoreComponents {
  quality: number;
  affinity: number;
  geo: number;
  freshness: number;
  isPromoted: boolean;
  /** عدد مرات ظهور هذا الإعلان للمستخدم خلال النافذة الأخيرة */
  seenCount: number;
}

/**
 * الدرجة النهائية = مجموع المركّبات بأوزانها، ناقص عقوبة التكرار.
 * الدفعة المدفوعة محدودة بوزنها ولا تلغي بقية الإشارات — إعلان ممول رديء
 * لا يستطيع أن يتصدّر إلى الأبد.
 */
export function finalScore(components: ScoreComponents, weights: RankingWeights): number {
  const promoted = components.isPromoted ? weights.promoted : 0;
  // العقوبة تتشبّع: أول ظهور مكرر يؤثر كثيرًا، والعاشر لا يضيف شيئًا
  const fatigue = weights.seenPenalty * (1 - 1 / (1 + components.seenCount));

  return (
    weights.quality * components.quality +
    weights.affinity * components.affinity +
    weights.geo * components.geo +
    weights.freshness * components.freshness +
    promoted -
    fatigue
  );
}

/**
 * تنويع النتائج: يمنع سيطرة معلن واحد على الموجز.
 * يحافظ على الترتيب النسبي ويؤجّل الإعلانات الزائدة لكل معلن إلى ما بعد غيرها.
 */
export function diversify<T extends { advertiserId: string }>(
  items: T[],
  maxPerAdvertiser: number,
): T[] {
  if (maxPerAdvertiser <= 0) return items;
  const counts = new Map<string, number>();
  const kept: T[] = [];
  const deferred: T[] = [];

  for (const item of items) {
    const count = counts.get(item.advertiserId) ?? 0;
    if (count < maxPerAdvertiser) {
      counts.set(item.advertiserId, count + 1);
      kept.push(item);
    } else {
      deferred.push(item);
    }
  }

  return [...kept, ...deferred];
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function parseWeights(raw: unknown): RankingWeights {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_RANKING_WEIGHTS };
  const input = raw as Partial<RankingWeights>;
  const result = { ...DEFAULT_RANKING_WEIGHTS };
  for (const key of Object.keys(DEFAULT_RANKING_WEIGHTS) as (keyof RankingWeights)[]) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      result[key] = value;
    }
  }
  return result;
}
