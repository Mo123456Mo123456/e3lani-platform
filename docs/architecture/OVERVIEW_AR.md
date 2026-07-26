# نظرة معمارية

```text
apps/mobile (Expo) ─┐
apps/web (Next.js) ─┼─► services/api (NestJS) ─► PostgreSQL
apps/admin (Next.js)┘          │
                               ├─► Redis / BullMQ
                               ├─► Payment Orchestration (adapters)
                               └─► Object Storage ◄─ media-worker (FFmpeg)
```

## قواعد حرجة

1. المراجعة قبل الدفع.
2. Order يرتبط بـ `adId` + `revisionId` + `pricingVersionId`.
3. تعديل المحتوى بعد الموافقة يعيد الإعلان للمراجعة ويلغي أهلية الدفع.
4. التفعيل عبر Webhook موثّق أو تحقق خادمي — ليس عبر Redirect.
5. iOS → StoreKit، Android → Play Billing، Web → Hosted Checkout عبر Routing Engine.
