# الذكاء الاصطناعي / AI Orchestration

<div dir="rtl">

## القاعدة الذهبية

> النتائج الأساسية تُحسب خوارزميًا في محرك المحاكاة. نموذج اللغة **يفهم، يوازن، ويشرح** — ولا يقرر مصير العالم.

## الطبقات

### 1) فهم إضافات المستخدم (parse)

نص حر (عربي/إنجليزي) → `StructuredContribution` منظم:

```json
{
  "category": "plant",
  "name": "شجرة الضوء العملاقة",
  "traits": { "size": 0.9, "growthRate": 0.3, "waterNeed": 0.7,
              "pollutionAbsorption": 0.95, "nightLuminosity": 0.8,
              "coldResistance": 0.4, "heatResistance": 0.7 },
  "possibleBiomes": ["tropical_forest", "temperate_forest"],
  "risks": ["high_water_consumption", "ecosystem_competition"]
}
```

- كل فئة لها **مواصفة خصائص** (`CATEGORY_TRAIT_SPEC`) بحدود دنيا/قصوى وافتراضيات؛ أي خرج نموذج يُقيَّد ويُتحقق قبل القبول (pydantic + zod في API).
- مع المزوّد الحقيقي: النموذج يحسّن مسودة المزوّد المحلي (draft-first)، وأي فشل JSON/شبكة يرجع للمسودة المحلية — لا تعطيل للتدفق أبدًا.

### 2) التوازن (balance)

- **ميزانيات قوة** لكل فئة (مجموع خصائص القوة ≤ سقف) → تصغير متناسب مع قائمة تعديلات شفافة.
- **ضرائب توازن**: تخزين طاقة عالٍ يفرض احتياج ماء؛ نمو سريع يحدّ القيمة الغذائية؛ جسم ضخم يبطئ التكاثر.
- **رفض بنّاء**: تدمير الكوكب/خلود/سيطرة مطلقة/طاقة لانهائية ⇒ `rejected` + **نسخة قابلة للعب** من الفكرة بدل الرفض المباشر.

### 3) الرسم السببي المبدئي (causal prior)

قالب ميكانيكي لكل فئة (إضافة → أولية → ثانوية → بعيدة) بأوزان من قوة الخصائص. يُعرض للمستخدم قبل التأكيد؛ **الأحداث المُحقَّقة تأتي من المحرك** وتُربط بنفس الجذر.

### 4) السرد (narration)

- المدخل الوحيد: الأحداث الحقيقية التي أنتجها المحرك للتو.
- Mock: قوالب حتمية من حمولات الأحداث (آمن 100% من الهلوسة).
- نموذج حقيقي: مُطالَب JSON صارم ثم **تحقق خلفي**: كل رقم/اسم في النص يجب وجوده في بيانات الأحداث؛ الفشل ⇒ رجوع قالب + `validated=false` (لا يُعرض محتوى مخترع أبدًا — اختبار `test_validator_rejects_fabricated_statistics`).

### 5) الوكلاء والشخصيات

قرارات قادة الحضارات خوارزمية (Utility AI + ذاكرة) في المحرك — ليست دردشة حرة. طبقة شخصيات LLM اختيارية مستقبلية فوق نفس القيود.

## المزوّدون

| المزوّد | الحالة | ملاحظات |
|---|---|---|
| `mock` | افتراضي | قواعد لغوية حتمية AR/EN؛ موسوم `sandbox:true` في كل استجابة وفي الواجهة |
| `openai` | عند `OPENAI_API_KEY` | JSON mode؛ fallback للمسودة عند أي فشل |
| `anthropic` | عند `ANTHROPIC_API_KEY` | نفس العقد |
| `gemini` | عند `GEMINI_API_KEY` | نفس العقد |

الاختيار: طلب صريح ← `AI_PROVIDER_DEFAULT` ← أول مزوّد مُعدّ ← mock. `GET /providers` يعرض حالة كل مزوّد بصراحة.

## الحماية من الحقن

- الإشراف يعمل **قبل** أي استدعاء نموذج (قوائم ثابتة: تجاهل التعليمات، أدوار، SQL، وسوم script، base64، قوالب `{{}}`، تكرار spam).
- نص المستخدم يُغلَّف كـ **بيانات JSON** داخل المطالبة ولا يُدمج في التعليمات نصًا.
- لا يتحول أي نص مستخدم إلى كود/SQL/أمر نظام في أي طبقة (لا `eval` في المشروع إطلاقًا).
- محاولات كسر قواعد العالم تُعلّم `flag` وتُراجَع في لوحة الإدارة.

## المحاسبة

كل استدعاء يسجل `ai_requests` (مزوّد، sandbox، رموز تقديرية، تكلفة USD محسوبة بجداول أسعار، زمن، حالة) → لوحة الإدارة (يومي/متوسطات) + حد ميزانية شهري `AI_MONTHLY_COST_BUDGET_USD` للتنبيهات.

</div>

## English

The engine computes all outcomes; LLMs only parse ideas (validated structured output), enforce balance (power budgets, balance taxes, constructive rejection), build causal priors, and narrate **post-validated** stories from real engine events — with deterministic template fallback whenever validation fails. Providers are pluggable (OpenAI/Anthropic/Gemini/Mock); the mock sandbox is clearly labeled everywhere. All calls are cost/latency-accounted for the admin dashboard.
