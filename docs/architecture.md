# المعمارية وقاعدة البيانات

## تدفق الكتابة

```mermaid
sequenceDiagram
  participant U as Web client
  participant A as Fastify API
  participant AI as AI orchestrator
  participant S as Simulation engine
  participant DB as PostgreSQL/PostGIS
  participant N as NATS
  participant W as WebSocket gateway

  U->>A: contribution idea (Bearer JWT)
  A->>A: validation + fixed-rule moderation
  A->>AI: untrusted payload as structured data
  AI-->>A: bounded structured traits + risks
  U->>A: preview(region, traits)
  A->>DB: load planet + region state + event history
  A->>S: Monte Carlo scenarios
  S-->>A: probabilities, uncertainty, causal factors
  U->>A: confirm(idempotency key)
  A->>S: introduceContribution
  S-->>A: event + direct effects
  A->>DB: transaction(contribution,event,region,notification,audit)
  A->>N: persisted event delta
  N->>W: world.delta.planetId
  W-->>U: WebSocket delta
```

فشل AI لا ينتج fallback صامتًا. يعيد API الخطأ `AI_PROVIDER_UNAVAILABLE` مع `fallbackUsed:false`. وضع Mock لا يعمل إلا عند اختيار `AI_PROVIDER=mock`، ويظهر `sandbox:true`.

## حدود الملكية

- `world-generator`: الحالة الجغرافية الابتدائية فقط.
- `simulation-engine`: الزمن، الآثار، الاحتمالات، replay وsnapshot.
- `ai-orchestrator`: فهم اللغة والموازنة والسرد المقيد فقط.
- `api`: auth، المعاملات، idempotency، orchestration وOpenAPI.
- `realtime-gateway`: نقل deltas؛ لا يحسب حالة.
- `web`: عرض وتفاعل؛ لا يملك قانون محاكاة.

## مخطط البيانات المختصر

```mermaid
erDiagram
  USER ||--|| PROFILE : has
  USER }o--o{ ROLE : assigned
  USER ||--o{ USER_CONTRIBUTION : creates
  PLANET ||--o{ PLANET_REGION : contains
  PLANET_REGION ||--o{ CLIMATE_CELL : records
  PLANET_REGION ||--o{ RESOURCE : contains
  PLANET_REGION ||--o{ SPECIES : habitats
  PLANET_REGION ||--o{ PLANT : habitats
  PLANET ||--o{ CIVILIZATION : hosts
  CIVILIZATION ||--o{ CITY : builds
  CIVILIZATION ||--o{ TECHNOLOGY : discovers
  CITY ||--o{ TRADE_ROUTE : connects
  PLANET ||--o{ WORLD_EVENT : records
  WORLD_EVENT ||--o{ CAUSAL_LINK : source
  WORLD_EVENT ||--o{ CAUSAL_LINK : target
  USER_CONTRIBUTION ||--o{ WORLD_EVENT : causes
  PLANET ||--o{ TIMELINE_SNAPSHOT : snapshots
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ AUDIT_LOG : acts
```

الجداول الفعلية الأخرى: cultures، languages، alliances، alliance_members، wars، diseases، migrations، simulation_ticks، ai_requests، moderation_results، refresh_tokens وworld_memory بـ`vector(1536)`.

## الاتساق

- `user_contributions.idempotency_key` فريد.
- تثبيت المساهمة يكتب المساهمة والحدث وحالة المنطقة والإشعار وaudit داخل transaction واحدة.
- tick يكتب الأحداث والمناطق و`simulation_ticks` داخل transaction واحدة.
- `world_events.cause` غير فارغ على مستوى قاعدة البيانات.
- السكان غير سالبين، وreducer يقيدهم بـcarrying capacity.
- PostGIS GiST index يخدم الاستعلامات الجغرافية.
- `world_memory` يملك HNSW cosine index للبحث الدلالي.

## قابلية التوسع

الحالة الدائمة في PostgreSQL، والدلتا العابرة عبر NATS. قبل تشغيل عدة كتّاب للمحاكاة يجب إضافة partition ownership أو distributed planet lock؛ الإصدار الحالي يفترض كاتب Tick واحدًا لكل كوكب. واجهات القراءة والـWebSocket قابلة للتوسع أفقيًا.
