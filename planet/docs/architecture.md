# المعمارية / Architecture

## نظرة عامة

```
┌────────────┐   HTTP    ┌──────────────┐   HTTP    ┌─────────────────────┐
│  apps/web  │ ────────► │ services/api │ ────────► │ simulation-engine   │
│  (R3F/WS)  │ ◄── WS ── │  (NestJS)    │ ◄──────── │  (Fastify, حتمي)    │
└────────────┘           └──────┬───────┘           └─────────────────────┘
                                │ HTTP                     ▲
                                ▼                          │ generate
                        ┌───────────────┐         ┌────────┴───────┐
                        │ ai-orchestrator│        │ world-generator │
                        └───────────────┘         └────────────────┘
                                ▲
        ┌───────────────────────┼───────────────────────────┐
        │                       │                           │
   PostgreSQL               Redis (cache)             NATS JetStream
   +PostGIS+pgvector        (جاهز، اختياري)          (جاهز، غير مفعّل)
        ▲
   notification-worker (HTTP poll → /internal/notify-impact)
```

## مبدأ الفصل الأساسي

- **simulation-models** (الحزمة): منطق نقي بلا I/O — يعمل في Node والمتصفح.
- **simulation-engine** (الخدمة): يملك الحالة الحية للعوالم في الذاكرة + لقطات
  دورية على القرص؛ لا يعرف شيئًا عن المستخدمين.
- **api**: يملك الاستمرارية (Postgres) والمصادقة وربط الأحداث بالمستخدمين
  والبث عبر WebSocket. المحرك يحسب، الـ API يحفظ ويوزّع.
- **ai-orchestrator**: لا يرى حالة العالم أبدًا؛ يحوّل نص↔بيانات ويشرح نتائج فقط.

## تدفق الإضافة (الأقسام 16، 32)

```
نص المستخدم
  → api/contributions (draft)
  → orchestrator /analyze  [إشراف ثابت → تحليل منظم → تحقق Zod → توازن]
  → (adjust؟ استبدال الخصائص بالمخففة)
  → engine /preview        [Monte Carlo: N فرعًا × آفاق 1/10/100/1000 سنة]
  → engine /contributions  [تطبيق + 12 tick متابعة]
  → api: persistEvents     [WorldEvent + CausalLink + SimulationTick]
  → WS broadcast (delta)   [world.event لكل المشتركين]
  → notification-worker    [أحداث contributionId لاحقة → إشعار المالك]
```

## لماذا TypeScript للمحرك بدل Python (قرار موثّق)

القسم ٥ يقترح Python/FastAPI «أو إطار مماثل قوي». اخترنا TypeScript لأن:

1. الحزمة نفسها تعمل في المتصفح → «المعاينة المحلية» الحقيقية (نفس الكود، نفس Seed).
2. عقود `shared-types` مشتركة حرفيًا بين الواجهة والمحرك والـ API — بلا ترجمة.
3. خط اختبار واحد (vitest) يغطي كل طبقات المنطق.

المحرك معزول خدمةً عبر HTTP؛ استبداله بخدمة Python لا يغيّر عقدًا واحدًا في API.

## قابلية التوسع

- المحرك عديم الحالة عبر الطلبات باستثناء سجل العوالم (قابل للمشاركة عبر لقطات).
- استخراج realtime-gateway إلى عملية مستقلة موثّق (`services/realtime-gateway/README.md`).
- PostgreSQL: فهارس على (planetId, seq/type/contributionId) + تقسيم زمني مستقبلي لـ WorldEvent.
