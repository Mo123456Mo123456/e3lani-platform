# النشر — Deployment

## Docker Compose (الطريق الموصى)

```bash
cp .env.example .env   # عدّل الأسرار في الإنتاج
docker compose up --build
```

الخدمات: `postgres` (postgis) · `redis` · `migrate` (ترحيلات) · `seed` (كوكب تجريبي حي) · `ai-orchestrator` :4100 · `api` :4000 · `web` :3000 · `admin` :3100 · `simulation-engine` (profile `worker` اختياري).

```bash
docker compose --profile worker up -d   # تشغيل عامل النبضات المستقل
```

## يدويًا

```bash
corepack enable && pnpm install
docker compose up -d postgres redis
export DATABASE_URL=postgresql://kawkab:kawkab@localhost:5432/kawkab
pnpm db:migrate:dev && pnpm db:seed
pnpm dev:api & pnpm dev:ai & pnpm dev:web & pnpm dev:admin &
```

## متغيرات الإنتاج الإلزامية

| المتغير | ملاحظة |
|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 حرفًا عشوائيًا — **غيّر الافتراضيات** |
| `DATABASE_URL` | PostgreSQL 16 |
| `COOKIE_SECURE=true` | خلف HTTPS |
| `CORS_ORIGINS` | نطاقاتك فقط |
| `AI_PROVIDER` + مفتاح المزود | وإلا Sandbox موسوم |
| `NEXT_PUBLIC_API_URL` | يُضمَّن وقت البناء في تطبيقي Next |

## CI/CD

`.github/workflows/ci.yml`:
1. **test**: تثبيت → بناء الحزم → typecheck → كل الاختبارات.
2. **build-apps**: بناء إنتاجي للواجهة والإدارة.
3. **integration**: خدمة PostgreSQL حقيقية → ترحيلات → زرع → تشغيل API → فحص دخاني كامل لتدفق المستخدم (تسجيل → معاينة إضافة → تأكيد → سرد).

النشر المقترح: صور Docker من نفس Dockerfiles (Buildx + registry)، وتشغيل `migrate deploy` كخطوة إصدار قبل تدوير الحاويات.

## النسخ الاحتياطي والتعافي

- `pg_dump` دوري (الأحداث + اللقطات = إعادة بناء العالم لأي نبضة).
- اللقطات داخل القاعدة كل 50 نبضة تعني أن فقدان ساعة عمل يكلف ≤ 50 سنة محاكاة من التقدم.
- الاسترجاع التشغيلي: `POST /api/simulation/:planetId/rollback {tick}` من لوحة الإدارة.

## المراقبة (الحالة الراهنة والمقترح)

متوفر الآن: سجل مُهيكل (Fastify/Nest loggers)، فحص صحة `/health` (زمن استجابة قاعدة البيانات)، مقاييس نبضة لكل كوكب (`SimulationTick.durationMs/eventCount` مع رسم في لوحة الإدارة)، محاسبة الذكاء الاصطناعي (`AIRequest`)، سجل تدقيق كامل.

مقترح للإنتاج (موثق في roadmap): تصدير OpenTelemetry spans من API، لوحة Grafana للتنبيهات الأربعة الحرجة (توقف النبضات، تراكم المهام `queuedJobs`، قفزة تكلفة AI، تدهور استعلامات قاعدة البيانات).
