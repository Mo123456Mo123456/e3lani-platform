# الاختبارات — Testing

## التشغيل

```bash
pnpm -r --if-present build   # أولًا (تبعيات مساحة العمل)
pnpm test                    # كل الاختبارات
```

## الاختبارات الإلزامية من الموجز وحالتها

| # | الاختبار | الملف | الحالة |
|---|---|---|---|
| 1 | نفس Seed ينتج التاريخ نفسه | `packages/simulation/src/engine.test.ts` | ✅ |
| 2 | إعادة تشغيل الأحداث تعيد الحالة نفسها | نفس الملف (replay 60 نبضة بإضافتين) | ✅ |
| 3 | لا حضارة دون موارد وسكان | نفس الملف | ✅ |
| 4 | لا حدث دون سبب | نفس الملف (فحص 50 نبضة كاملة) | ✅ |
| 5 | لا ذكر نتائج غير موجودة | `packages/ai/src/ai.test.ts` (فاحص التأسيس + مزود هلامي) | ✅ |
| 6 | سقف السكان للمنطقة | `engine.test.ts` | ✅ |
| 7 | مشروعية مسارات الهجرة | `engine.test.ts` (A* بري + مسارات المحرك) | ✅ |
| 8 | رفض/ترويض المحظور | `engine.test.ts` + `packages/validation` | ✅ |
| 9 | استرجاع أي Snapshot | `engine.test.ts` (تطابق هاش + استمرار المستقبل) | ✅ |
| 10 | ثبات مع آلاف الأحداث | `engine.test.ts` (أداء 200 نبضة) + بناء الواجهة | ✅ جزئيًا (واجهة: حد الرسائل 200) |

## طبقات أخرى منفذة

- **Unit**: RNG forks، balance، moderation، sanitization، geo math، overlay colors، analytics batching، auth (تسجيل/دخول/تدوير/كشف إعادة استخدام)، notification worker.
- **Integration (CI)**: PostgreSQL حقيقي — ترحيلات + زرع + دخاني REST كامل لتدفق الإضافة حتى السرد.
- **Property-like**: توليد العالم بنفس البذرة مرتين ⇒ تطابق JSON كامل للخلايا؛ بذرتان مختلفتان ⇒ اختلاف.

## مُوفَّر ويحتاج تفعيلًا (موثق بصدق)

| الطبقة | الملف | التفعيل |
|---|---|---|
| E2E (Playwright) | `tests/e2e/` | `pnpm dlx playwright install` ثم `npx playwright test` — يتطلب متصفحات وخدمات عاملة |
| Load (k6) | `tests/load/k6-ticks.js` | `k6 run` ضد بيئة Docker Compose |
| Visual regression | — | غير مفعّل بعد (roadmap) |
| Security scanning | — | مقترح: OWASP ZAP baseline في CI (roadmap) |
