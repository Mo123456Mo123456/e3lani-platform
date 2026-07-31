# ربط الذكاء الاصطناعي / AI Integration

## المبدأ: الخوارزمية تقرر، النموذج يشرح

الذكاء الاصطناعي في طبقات محددة فقط، ولا يحل محل محرك المحاكاة أبدًا.

## الطبقات

### 1) فهم إضافات المستخدم (Structured Output)

نص حر (عربي/إنجليزي) → JSON منظم بعقد `AnalyzedContribution`
(١٧ خاصية 0..1 + بيومات + مخاطر + مزايا). المخرجات **تُتحقق بـ Zod قبل قبولها**؛
أي مزود يعيد بيانات فاسدة يُستبدل فورًا بالمحلل المحلي.

### 2) التوازن (Balance)

قواعد ثابتة تمنع العناصر الخارقة (خلود، لانهاية، تدمير فوري، سيطرة مطلقة،
إلغاء قوانين). بدل الرفض الجاف: **اقتراح نسخة مخففة** (`verdict: adjust`
مع `adjustedTraits`) يطبَّق فعليًا عند التأكيد — مُختبَر أن الخصائص المعدّلة
هي ما يصل المحرك.

### 3) المحاكاة السببية

ليست AI: رسم سببي من الأحداث (`causes[]`) + Monte Carlo في المحرك.

### 4) السرد المؤسَّس (Grounded Narrative)

المدخل الوحيد للنموذج = قائمة حقائق المحاكاة. بعد الإجابة، فلتر
`enforceGrounding` يحذف أي جملة تذكر سنة غير موجودة في الحقائق — مُختبَر.
وضع Sandbox يستخدم قوالب حتمية موسومة `llmGenerated: false`.

### 5) الوكلاء

قرارات الحضارات من Utility AI داخل المحرك (وليست دردشة LLM).

## المحولات (Provider Adapters)

```
LLMProvider { isLive(), analyze(), narrate() }
 ├─ MockProvider       محلي حتمي، sandbox:true دائمًا
 ├─ OpenAIProvider     JSON Schema strict — يتطلب OPENAI_API_KEY
 ├─ AnthropicProvider  يتطلب ANTHROPIC_API_KEY
 └─ GeminiProvider     يتطلب GEMINI_API_KEY
```

الأولوية: أول مزود **حيّ**؛ وإلا Sandbox. `GET /providers` يعرض الحالة بصراحة
(`live` / `no key` / `sandbox`). **في الإنتاج بلا مفاتيح تُوسم النتائج Sandbox
ولا تُعرض كذكاء اصطناعي حقيقي.**

## الإشراف (Moderation)

قواعد ثابتة أولًا: Prompt Injection (`ignore instructions`, `DROP TABLE`…)،
تهريب شيفرة (```bash```، `process.env`…)، محتوى مسيء، تكرار مزعج (hash cache)،
طول. المحظور يرفض 422 ويُسجَّل في `ModerationResult`. النص الحر لا يتحول أبدًا
إلى كود/SQL/أوامر — المحرك يقبل JSON متحققًا فقط.

## التكلفة

كل طلب يُسجَّل في `AIRequest` (provider, kind, tokens, costUsd, sandbox, durationMs)
وتعرضه لوحة الإدارة `/admin/ai-usage`.
