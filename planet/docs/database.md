# قاعدة البيانات / Database

PostgreSQL 16 + PostGIS + pgvector (صورة `docker/db`). Prisma ORM.

## الكيانات (30 جدولًا — القسم 23)

- **الهوية**: User, Profile, Role (١٠ أدوار), RefreshToken (تدوير + كشف إعادة استخدام)
- **الكوكب**: Planet, PlanetRegion (لكل خلية), Biome (جدول مرجعي), ClimateCell (عينات زمنية)
- **الحياة**: Species (fauna), Plant (flora), Resource
- **الحضارات**: Civilization, City, Technology, Culture, Language, TradeRoute, Alliance, War, Disease, Migration
- **المحاكاة**: UserContribution, SimulationTick (checksum لكل نبضة), WorldEvent (سجل الأحداث), CausalLink (الرسم السببي), TimelineSnapshot
- **المنصة**: AIRequest (تكلفة/استهلاك), ModerationResult, Notification, AuditLog

## القرارات

- `WorldEvent.embedding vector(1536)`: موجود للبحث الدلالي في الذاكرة العالمية
  (تاريخ الحضارات/الحروب/العلاقات) — يُفعَّل عند ضبط مزود تضمين؛ غير مستخدم حتى ذلك الحين (موثّق).
- الإحداثيات المكانية `lat/lon` أعمدة Float صريحة؛ امتداد PostGIS مثبّت للاستعلامات
  الجغرافية المستقبلية دون إعادة ترحيل.
- `@@unique([planetId, seq])` على WorldEvent يجعل إعادة الاستمرار idempotent.
- `SimulationTick.checksum` يربط كل نبضة بسلسلة التجزئة (كشف العبث على مستوى DB).

## الترحيلات والبذر

```bash
pnpm --filter @planet/api exec prisma migrate deploy   # 0001_init (مولّد من المخطط)
pnpm --filter @planet/api run seed                     # أدوار + حسابات sandbox + الكوكب التجريبي
```

البذر يشغّل **المحرك الحقيقي** (1000 نبضة × 5 سنوات = 5000 سنة): 800+ نبات،
300+ مخلوق، 12 حضارة، ~96 مدينة، 120 موردًا، 51 تقنية، 17 حربًا، 3 تحالفات،
~130 ألف حدث مع CausalLink. لا بيانات مختلقة يدويًا.

CI يتحقق أن **انحراف المخطط صفر** (`prisma migrate diff --exit-code`).

## مخطط العلاقات (مبسّط)

```
User 1─∞ UserContribution ∞─1 Planet
Planet 1─∞ WorldEvent ∞─∞ (self via CausalLink fromSeq→toSeq)
Planet 1─∞ Civilization 1─∞ City ∞─∞ (TradeRoute from/to)
Planet 1─∞ Species | Plant | Resource | War | Alliance | Disease | Migration
User 1─∞ Notification | RefreshToken | AIRequest | AuditLog
```
