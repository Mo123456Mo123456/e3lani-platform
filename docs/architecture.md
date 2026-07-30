# معمارية «كوكب يولد أمامك»

## حدود المكونات

```mermaid
flowchart LR
    WEB["apps/web<br/>Next.js + R3F"] -->|REST| API["services/api<br/>NestJS"]
    ADMIN["apps/admin<br/>Next.js"] -->|REST + RBAC| API
    WEB <-->|Socket.IO delta| API
    API -->|validated request| AI["services/ai-orchestrator<br/>FastAPI"]
    API --> SIM["@planet/simulation-models"]
    API --> PG[("PostgreSQL<br/>PostGIS + pgvector")]
    API -.-> REDIS[("Redis")]
    API -.-> NATS[("NATS JetStream")]
    AI --> OPENAI["OpenAI adapter"]
    AI --> ANTHROPIC["Anthropic adapter"]
    AI --> GEMINI["Gemini adapter"]
    AI --> MOCK["Declared mock adapter"]
```

- `simulation-models` هو المصدر السلطوي للنتائج الرقمية. لا يستدعي نموذجًا لغويًا.
- `ai-orchestrator` يستخرج بنية صالحة ويوازنها، أو يصوغ سردًا من أحداث مسموحة.
- `api` يملك المعاملة: التحقق ← المعاينة ← المحاكاة ← الحفظ ← البث.
- `web` لا يحتوي منطق المحاكاة؛ يبني الشكل الهندسي من `PlanetRegion` ويطبق Delta فقط.
- Redis وNATS معرّفان في البنية ليُستخدما عند فصل العمال والبوابة، لكنهما غير موصولين بمسار المرحلة الحالية ولا يُعرضان كقدرة مفعلة.

## مسار المساهمة

```mermaid
sequenceDiagram
    actor U as المستخدم
    participant W as Web
    participant A as API
    participant I as AI Orchestrator
    participant S as Simulation Engine
    participant D as PostgreSQL
    participant R as Realtime Gateway

    U->>W: فكرة + فئة + منطقة
    W->>A: POST /contributions/analyze
    A->>I: نص غير موثوق + JSON schema
    I-->>A: Structured Output + moderation + balance
    W->>A: POST /contributions/preview
    A->>S: 64 مسارًا ببذور مشتقة
    S-->>A: آفاق واحتمالات وعدم يقين
    U->>W: تأكيد
    W->>A: POST /contributions/confirm + Bearer
    A->>S: addContribution + runTick
    S-->>A: state + causal events + delta
    A->>D: transaction(events, links, tick, snapshot)
    D-->>A: commit
    A->>R: world.delta
    R-->>W: changedRegions + events فقط
```

لا يبث الخادم نجاحًا ولا Delta قبل اكتمال معاملة قاعدة البيانات.

## نموذج البيانات الأساسي

```mermaid
erDiagram
    USERS ||--o{ USER_CONTRIBUTIONS : owns
    USERS ||--o{ REFRESH_TOKENS : rotates
    PLANETS ||--o{ PLANET_REGIONS : contains
    PLANETS ||--o{ CIVILIZATIONS : contains
    PLANETS ||--o{ WORLD_EVENTS : records
    PLANETS ||--o{ TIMELINE_SNAPSHOTS : snapshots
    PLANETS ||--o{ SIMULATION_TICKS : advances
    PLANET_REGIONS ||--o{ USER_CONTRIBUTIONS : starts_at
    PLANET_REGIONS ||--o{ CIVILIZATIONS : hosts
    USER_CONTRIBUTIONS ||--o{ WORLD_EVENTS : causes
    WORLD_EVENTS ||--o{ CAUSAL_LINKS : target
    WORLD_EVENTS ||--o{ CAUSAL_LINKS : source
```

تحتفظ `timeline_snapshots.state` بالحالة القابلة للاستعادة، بينما يبقى `world_events` سجلًا مرتبًا لاستخراج السببية والتاريخ. يحمل كل Tick checksum مشتقًا من الحالة لتدقيق إعادة التشغيل.

## الأمان

- كلمات المرور: `scrypt` مع salt عشوائي.
- Access token قصير العمر؛ Refresh token عشوائي مخزن كـ SHA-256 وقابل للدوران.
- ValidationPipe يمنع الحقول غير المعروفة.
- CORS allowlist وHelmet CSP وThrottler مفعلون.
- WebSocket بلا token للقراءة فقط؛ token غير صالح يقطع الاتصال.
- أوامر Tick الإدارية محمية بـ RBAC.
- مدخل المستخدم لا يتحول إلى كود أو SQL أو system prompt.

## التوسع

تُفصل الخطوات التالية دون تغيير العقود الحالية:

1. نشر Ticks إلى NATS وتشغيل `simulation-engine` كعامل مستقل.
2. تخزين Hot deltas والأقفال الموزعة في Redis.
3. تقسيم المناطق إلى chunks مع texture/geometry streaming.
4. إضافة workers للإشعارات والذاكرة الدلالية.
5. نقل snapshots إلى تخزين كائني مع فهرس PostgreSQL عند تضخم الحالة.
