# معمارية منصة كوكب

## حدود النظام

```mermaid
flowchart LR
  W[apps/web<br/>Next.js + R3F] -->|HTTPS + HttpOnly cookie| A[services/api<br/>Fastify]
  M[apps/admin<br/>Protected Next.js] -->|HTTPS + RBAC| A
  W <-->|WebSocket delta| A
  A --> P[(PostgreSQL<br/>PostGIS + pgvector)]
  A <-->|world.delta| N[NATS JetStream]
  A --> I[AI provider adapter]
  A --> S[simulation-models]
  S --> T[shared-types / Zod]
  A --> R[(Redis<br/>reserved for queues/cache)]
  A --> O[(S3 / MinIO<br/>reserved for assets)]
```

`simulation-models` لا يستورد HTTP أو قاعدة بيانات أو React. الخادم وحده
ينسّق المصادقة والحفظ والمعاملات والبث. الواجهة تعرض Projections ولا تحتوي
على قواعد المحاكاة.

## مسار المساهمة

```mermaid
sequenceDiagram
  actor U as المستخدم
  participant W as Web
  participant A as API
  participant AI as AI Adapter
  participant E as Algorithmic Engine
  participant DB as PostgreSQL
  participant WS as WebSocket/NATS

  U->>W: يكتب الفكرة ويختار المنطقة
  W->>A: POST /contribution/analyze
  A->>A: moderation + prompt-injection rules
  A->>AI: structured advisory classification
  A->>E: deterministic effects from proposal + world state
  E-->>A: bounded effects + grounded causes
  A-->>W: analysis + provider status
  W->>A: POST /contribution/preview
  A->>E: seeded Monte Carlo
  A-->>W: p10 / median / p90 + uncertainty
  U->>W: تأكيد
  W->>A: POST /contribution/commit + idempotency key
  A->>DB: atomic contribution/tick/event/links/snapshot/notification
  A->>WS: world.delta
  WS-->>W: invalidate projections
```

## Event sourcing

- `world_events` سجل append-oriented؛ الحذف المنطقي بعد rollback عبر
  `is_retracted`.
- `causal_links` يربط حدثًا سابقًا بحدث لاحق مع العلاقة والقوة.
- `timeline_snapshots` يحمل checksum وحالة Projection عند Tick معلوم.
- `simulation_ticks` يمنع تكرار رقم Tick لكل كوكب.
- محرك الحزمة يدعم `replay(events)` مستقلًا عن قاعدة البيانات، وتغطيه اختبارات
  حتمية.

## الأمان

- كلمات المرور Scrypt مع Salt، والجلسة JWT داخل Secure/HttpOnly cookie.
- فحص الجلسة المخزنة يسمح بإبطالها، وليس توقيع JWT وحده.
- RBAC مع تجاوز محدود لـ `super_admin`، ومفاتيح Sandbox مطلوبة لترقية الدور.
- CORS allow-list، Helmet/CSP، body limit، rate limiting، Zod وJSON Schema.
- نص المستخدم يعامل كبيانات غير موثوقة؛ لا ينفذ ككود أو SQL أو system prompt.
- وضع الإنتاج يرفض Mock AI وذاكرة Sandbox.

## حدود النسخة الحالية

Redis وMinIO موجودان في بيئة التشغيل لكن لا توجد Queue workers أو ملفات مستخدم
مفعلة بعد. PostGIS وpgvector مفعّلان في صورة التطوير، بينما تستخدم الجداول
الأولية latitude/longitude وJSONB لتبقى migration قابلة للعمل على PostgreSQL
مقيّد. الخدمات المنفصلة المذكورة في الرؤية (notification worker وworld
generator service) ممثلة حاليًا بحزم وحدود داخلية، وليست عمليات مستقلة بعد.
