# النشر / Deployment

## الإقلاع المحلي الكامل (Docker)

```bash
cd planet && cp .env.example .env
docker compose up -d --build
docker compose up -d migrate
docker compose --profile setup run --rm seed
```

ترتيب الاعتماد: `db (healthy) → migrate → seed → api → web/admin/workers`.

## متغيرات إلزامية للإنتاج

| المتغير | لماذا |
|---|---|
| `JWT_SECRET` | عشوائي طويل — بدونه يرفض API الإقلاع في production |
| `DATABASE_URL` | PostgreSQL مُدار (يفضّل +PostGIS/pgvector) |
| `INTERNAL_TOKEN` | سر مشترك لنقاط /internal/* |
| `CORS_ORIGIN` | نطاقات الواجهة فقط (لا `*`) |
| `NEXT_PUBLIC_API_URL` | عنوان API العلني |
| `OPENAI/ANTHROPIC/GEMINI_API_KEY` | اختياري — بلاها Sandbox موسوم |

## بناء صورة خدمة واحدة

```bash
docker build -f docker/node-service.Dockerfile \
  --build-arg PACKAGE=@planet/api -t planet/api .
```

## بيئة إنتاج مرجعية

- **web/admin**: خلف CDN؛ admin خلف VPN/allowlist.
- **api**: ≥2 نسخ خلف LB (الـ RateLimiter داخلي الذاكرة — للتوسع الأفقي انقله
  إلى Redis؛ نقطة موثقة).
- **simulation-engine**: نسخة لكل عالم نشط (أو sharding بالـ worldId).
- **db**: PostgreSQL مُدار + نسخ احتياطي PITR.
- **NATS**: فعّل مسار event bus لفصل realtime-gateway (انظر README المجلد).

## الصحة والمراقبة

- `GET /health` على كل خدمة (db/engine/orchestrator + uptime).
- `/admin/services/health` و`/admin/overview` للوحة الإدارة.
- فشل المزود الحي → سقوط تلقائي للمحلل المحلي مع وسم sandbox (لا صمت).
- OpenTelemetry الكامل: غير مفعّل في هذه المرحلة (موثّق في README).

## CI/CD

`.github/workflows/planet-ci.yml` (جذر المستودع):
install → prisma generate → build packages → typecheck → كل الاختبارات →
بناء الخدمات والتطبيقات + وظيفة `migration-check` بقاعدة حقيقية تتحقق انحراف
المخطط صفر.
