# النشر / Deployment

<div dir="rtl">

## التشغيل المحلي الكامل

```bash
docker compose up -d --build
docker compose exec api pnpm run db:seed
docker compose logs -f api
```

صحّة الخدمات: `GET /ready` (DB + engine) و`/health` لكل خدمة بايثون.

## الإنتاج (خطوط عامة)

1. **الصور**: `infra/docker/*.Dockerfile` متعددة المراحل (build → runtime بلا أدوات بناء). API يعمل `node dist/main.js`؛ الواجهات Next standalone.
2. **قاعدة البيانات**: PostgreSQL 16 مُدار مع PostGIS + pgvector مفعّلين. طبّق الترحيلات عند الإقلاع (`MIGRATE_ON_BOOT=true` افتراضيًا) أو يدويًا `pnpm --filter @planet/api db:migrate`.
3. **الأسرار**: من مدير أسرار المنصة → متغيرات بيئة (لا تُبنى في الصور).
4. **التوسع**:
   - API عديم الحالة (عدا Rate-limit المحلي → Redis عند تعدد النسخ).
   - ticks تُشغَّل على نسخة واحدة (`SIM_AUTO_RUN=true` في نسخة مخصصة، `false` في باقي النسخ) أو منافسة DB (`FOR UPDATE SKIP LOCKED` للمهام).
   - WebSocket عبر sticky sessions أو ناقل Redis/NATS لمشاركة الغرف.
5. **CDN**: ملفات `.next/static` والخامات عبر CDN؛ زمن استجابة طبقات الخرائط مقبول من التخزين في DB للنسخة الأولى.
6. **النسخ الاحتياطي**: `pg_dump -Fc` يوميًا + WAL archiving؛ اختبار استعادة موثق ربع سنوي؛ snapshots داخلية كل 25 tick كخط دفاع إضافي للتراجع المنطقي.

## المراقبة

- سجلات مهيكلة (Nest logger + request ids في رؤوس `x-ratelimit-*`).
- مقاييس تشغيل في `/admin/metrics` (مستخدمون، إضافات، أحداث، تكلفة وزمن AI، اتصالات WS).
- تنبيهات مقترحة للربط بأي منصة مراقبة:
  - توقف ticks (`simulation_ticks` راكد > 60ث).
  - تراكم `jobs` (queued > 20).
  - تكلفة AI تتجاوز `AI_MONTHLY_COST_BUDGET_USD`.
  - فشل متكرر للمحرك/المنسّق في `/ready`.
- تتبع تحليلات المنتج في `analytics_events` (دفعات من الواجهة، بلا بيانات حساسة).

## CI/CD

`.github/workflows/ci.yml`:
1. **python-services**: pytest للمحرك والمنسّق.
2. **node**: تثبيت، بناء الباقات، typecheck، اختبارات وحدات، بناء api/web/admin.
3. **integration**: Postgres خدمة + خدمتا بايثون + migrations + seed مصغّر (`SEED_TICKS=30`) + إقلاع API + `scripts/acceptance.sh` كاملًا.
4. **docker**: تحقق compose + بناء صور api/engine/orchestrator.

## متغيرات البيئة

كلها موثقة في `.env.example` — لا قيم إنتاجية في المستودع.

</div>

## English

Multi-stage Docker builds for all five services; `docker compose up -d` gives the full stack (Postgres+PostGIS+pgvector, Redis, NATS, MinIO, engine, orchestrator, API, web, admin). Migrations run on boot; secrets via env; scale API statelessly with a single tick runner; daily `pg_dump` + internal snapshots for rollback. CI covers Python tests, Node typecheck/tests/builds, a full integration job with seeded DB and an end-to-end acceptance script, and Docker image builds.
