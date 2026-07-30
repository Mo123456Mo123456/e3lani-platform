# معمارية «كوكب يولد أمامك» / Living Planet Architecture

## حالة التنفيذ الحالية

هذه المرحلة شريحة رأسية قابلة للتشغيل وليست ادعاءً باكتمال المنصة الإنتاجية كلها.

المكتمل فعليًا:

- مولد عالم إجرائي حتمي من `Seed`.
- 192 إقليمًا مترابطًا بخصائص ارتفاع ورطوبة وحرارة وخصوبة وموارد ومنطقة حيوية.
- 12 حضارة أولية لا تُنشأ إلا في أقاليم لها قدرة استيعابية.
- محرك `Ticks` حتمي؛ كل Tick يساوي عشر سنوات.
- أحداث بأسباب صريحة، وروابط سببية، ودرجة ثقة، وأثر مباشر.
- مساهمات مستخدم محفوظة ومرتبطة بإقليم المنشأ وبالأحداث الناتجة عنها.
- محلل Sandbox محلي معلن ينتج Structured Output متحققًا منه عبر Zod.
- قواعد موازنة وإشراف تمنع التعليمات البرمجية والخصائص المطلقة.
- محاكاة Monte Carlo حتمية تعرض أفضل/أسوأ/أكثر مسار احتمالًا وعدم اليقين.
- لقطات زمنية ومعاينة تاريخية لا تغيّر الحاضر.
- كوكب WebGL إجرائي قابل للدوران والتقريب والاختيار، وعلاماته مشتقة من الأحداث.
- تخزين محلي عبر `AsyncStorage` للنسخة الحالية.

غير المكتمل، ولذلك لا يظهر في الواجهة كميزة جاهزة:

- PostgreSQL/PostGIS وEvent Store خادمي للكوكب.
- WebSocket/NATS والتحديثات متعددة المستخدمين.
- مزودو OpenAI وAnthropic وGemini.
- تطبيق إدارة مستقل للكوكب.
- الاقتصاد والحروب والأمراض كنماذج عميقة كاملة.
- مصادقة المستخدم الجديدة وربط المساهمات بحسابات إنتاجية.

## حدود الوحدات

```text
app/
  (tabs)/index.tsx                 نقطة دخول المنتج
components/living-planet/
  world-dashboard.tsx             تجربة الاستكشاف والتحكم
  planet-globe.web.tsx            WebGL/Three.js
  planet-globe.tsx                عرض أصلي منخفض الكلفة
  contribution-modal.tsx          تحليل/توازن/مستقبل/تأكيد
lib/
  living-planet-store.tsx         حالة التشغيل، اللقطات، التخزين
packages/simulation-models/src/
  types.ts                        عقد المجال والأحداث
  world-generator.ts              التوليد الإجرائي الحتمي
  simulation-engine.ts            Ticks والانتشار والسببية
  contribution-analyzer.ts        Structured Output والإشراف
tests/
  living-planet-simulation.test.ts
```

لا يحتوي مكون الواجهة على قواعد المحاكاة. الواجهة تستدعي العقود العامة من
`packages/simulation-models` فقط، ويمكن نقل الحزمة نفسها لاحقًا إلى Worker أو خدمة مستقلة.

## توليد العالم

يولّد `generateWorld(seed)` نقاطًا شبه متساوية المساحة على الكرة بطريقة Fibonacci Sphere.
تُحسب خرائط الارتفاع والرطوبة والصفائح والموارد من Fractal Value Noise متعدد الطبقات.
ويحدد المصنف المنطقة الحيوية من:

```text
biome = f(elevation, moisture, temperature, volcanic pressure)
```

تتأثر الحرارة بخط العرض والارتفاع وقرب المحيط. وتتأثر الرطوبة بضوضاء الرياح وظل المطر.
نفس `Seed` وعدد الأقاليم ينتجان JSON متطابقًا.

## دورة المحاكاة

ينفذ `stepWorld` بالترتيب:

1. حساب أثر المساهمات الموجودة في كل إقليم.
2. تحديث التلوث والرطوبة والحرارة والخصوبة.
3. تحديث القدرة الاستيعابية.
4. نمو السكان بنمو لوجستي مقيد بالقدرة الاستيعابية.
5. محاولة انتشار المساهمات إلى موائل مجاورة مناسبة.
6. إنشاء أحداث نظامية عند تحقق شروط قابلة للتتبع.
7. تحديث الحضارات والمقاييس العالمية.
8. حفظ روابط `cause -> event` وإرجاع Delta.

لا يستخدم المحرك `Math.random()`. كل احتمال يمر عبر `seededUnit(seed, ...causalParts)`.
لذلك تعيد إعادة التشغيل الحالة نفسها.

## حدود الذكاء الاصطناعي

`analyzeContributionSandbox` ليس نموذجًا لغويًا ولا يُعرض للمستخدم كذلك. يحول النص
إلى خصائص رقمية بقواعد معلنة، ثم يمرر النتيجة عبر `contributionAnalysisSchema`.
عند إضافة مزود خارجي يجب أن يطبق العقد نفسه:

```ts
interface ContributionProvider {
  analyze(input: string, category: ContributionCategory): Promise<ContributionAnalysis>;
}
```

ويجب أن تبقى الخطوات التالية خوارزمية:

- ملاءمة الموطن.
- الانتشار.
- القدرة الاستيعابية.
- أثر التلوث والماء.
- نتائج السيناريوهات.
- إنشاء الروابط السببية.

يمكن للنموذج اللغوي لاحقًا صياغة سرد من `WorldEvent[]` فقط، مع تحقق يمنع ذكر كيان
أو قيمة أو حدث غير موجود في البيانات.

## الحفظ واللقطات

تحفظ النسخة الحالية `WorldState` و`WorldSnapshot[]` محليًا. المعاينة التاريخية للقراءة
فقط ولا تعمل كـ rollback. في الانتقال للخادم يجب حفظ:

- Stream أحداث غير قابل للتعديل.
- Snapshot دوري يحمل رقم آخر حدث.
- قفل تفاؤلي على رقم Tick.
- Idempotency key لكل مساهمة.
- Delta منفصل للبث اللحظي.

## Production target

The production migration keeps the current domain boundary and moves execution behind:

```text
web -> API -> contribution command -> event bus -> simulation worker
                                      -> event store -> realtime gateway
```

PostgreSQL/PostGIS stores authoritative state and geometry; Redis only caches projections;
NATS JetStream delivers commands and deltas. AI providers remain behind server-side adapters,
and no provider key is bundled into the client.
