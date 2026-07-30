# معمارية ومحرك «كوكب يولد أمامك»

## مبدأ السلطة

هناك ثلاثة حدود لا يجوز تجاوزها:

1. الواجهة تعرض الحالة ولا تحسب التاريخ.
2. الذكاء الاصطناعي يحول اللغة إلى عقد منظم، ولا يكتب أحداث العالم.
3. محرك المحاكاة وحده ينتج `directImpact` ويغير `WorldState`.

## دورة الكتابة

```mermaid
sequenceDiagram
  actor User
  participant Web
  participant API
  participant AI as AI Orchestrator
  participant Engine
  participant DB as Event Store
  participant WS as Realtime Gateway

  User->>Web: فكرة عنصر
  Web->>API: POST /contributions/analyze
  API->>AI: نص غير موثوق + category + locale
  AI->>AI: injection rules + provider schema + balancing
  AI-->>API: ContributionAnalysis
  API-->>Web: معاينة خصائص ومخاطر + sandbox flag
  User->>Web: اختيار المنطقة والتأكيد
  Web->>API: POST /worlds/:id/contributions
  API->>Engine: validated analysis + region + user
  Engine-->>API: state transition + causal event
  API->>DB: transaction(event, region, contribution, state hash)
  DB-->>API: committed
  API->>WS: delta only
  WS-->>Web: world.event
```

لا يرسل API نجاحًا أو WebSocket delta قبل نجاح معاملة التخزين. وضع
`memory-sandbox` استثناء محلي ظاهر، ومحظور عند `APP_ENV=production`.

## التوليد الإجرائي

`generateWorld(seed)` يستخدم:

- توزيع Fibonacci sphere للخلايا المتقاربة المساحة.
- Fractal value noise للقارات والرطوبة والحرارة والموارد.
- Ridge noise لتقريب سلاسل الجبال وحدود الصفائح.
- خط العرض، الارتفاع، تأثير المحيط، وظل المطر لحساب المناخ.
- مصنفًا حتميًا للأقاليم: ocean, coast, plains, rainforest,
  temperate_forest, desert, mountain, tundra, wetland, steppe, volcanic, ice.

معرفات العالم والمناطق والكيانات مشتقة من Seed عبر UUIDv5-like deterministic
hash. لا تستخدم `Math.random` أو الوقت الحقيقي في التوليد.

## الزمن وإعادة التشغيل

مولد الأرقام `SeededRandom` هو xoshiro-family state machine. ينشئ كل Tick
مولدًا من:

```text
world.seed + ":tick:" + nextTick
```

وينتهي بحدث `SIMULATION_TICK_COMPLETED`. لذلك لا يعتمد Replay على وجود حدث
مناخي في نهاية الفترة. يحتوي كل `WorldEvent` على:

- sequence متزايد بلا فجوات.
- tick وyear.
- cause لا يمكن أن يكون فارغًا.
- causeEventIds وactorIds.
- regionId وcontributionId عند وجودهما.
- payload وdirectImpact وconfidence.
- occurredAt مشتق حتميًا من sequence، لا من ساعة الخادم.

تطبق `replayWorld` الأحداث حسب sequence وترفض أي فجوة. تحسب `hashWorld`
serialization مرتبة المفاتيح للحالة المؤثرة. تحفظ Snapshot نسخة الحالة وhash؛
يرفض `restoreSnapshot` أي تعديل في المحتوى.

## نموذج التأثير الحالي

المقطع الأول ينفذ تأثير النبات فعليًا:

1. يحسب ملاءمة الموطن من الماء والحرارة والتكيف.
2. يطبق تغير الخصوبة وامتصاص التلوث ضمن حدود `[0,1]`.
3. يستخدم احتمالًا seeded لانتشار البذور.
4. يختار أقرب منطقة متوافقة بالمسافة الزاوية.
5. ينشئ `PLANT_SPREAD` أو `POLLUTION_CHANGED`.
6. يربط الحدث بأحدث حدث سابق للمساهمة داخل causal graph.

نماذج الاقتصاد والحرب والأمراض العميقة موجودة في مخطط البيانات، لكنها ليست
منفذة في محرك المرحلة الأولى ولا تعرض الواجهة رسومًا لها.

## مخطط البيانات المختصر

```mermaid
erDiagram
  USER ||--|| PROFILE : has
  USER }o--o{ ROLE : assigned
  PLANET ||--o{ PLANET_REGION : contains
  BIOME ||--o{ PLANET_REGION : classifies
  PLANET ||--o{ WORLD_EVENT : records
  PLANET ||--o{ TIMELINE_SNAPSHOT : snapshots
  PLANET_REGION ||--o{ SPECIES : hosts
  PLANET_REGION ||--o{ PLANT : hosts
  PLANET_REGION ||--o{ RESOURCE : contains
  PLANET_REGION ||--o{ CIVILIZATION : hosts
  CIVILIZATION ||--o{ CITY : owns
  USER ||--o{ USER_CONTRIBUTION : creates
  USER_CONTRIBUTION ||--o{ WORLD_EVENT : causes
  WORLD_EVENT ||--o{ CAUSAL_LINK : source
  WORLD_EVENT ||--o{ CAUSAL_LINK : target
  USER ||--o{ NOTIFICATION : receives
  PLANET ||--o{ WORLD_MEMORY : remembers
```

`world_memory.embedding` هو vector(1536). حقول الخلية الجغرافية جاهزة للترقية
إلى PostGIS geometry؛ النسخة الحالية تحفظ latitude/longitude وJSON cell حتى
تستقر tessellation النهائية.

## التوسع المخطط

- استخراج `WorldService` إلى worker مستقل متصل بـNATS JetStream.
- تحويل WebSocket داخل API إلى realtime-gateway أفقي يعتمد Redis adapter.
- حفظ Snapshot مضغوط في S3 كل N ticks.
- إضافة Monte Carlo branches كنسخ state مع scenario seed مستقل.
- تطبيق ECS systems منفصلة للمناخ، الغذاء، السكان، الاقتصاد والدبلوماسية.
- إضافة OpenTelemetry spans حول AI، المعاملة، tick، والبث.
