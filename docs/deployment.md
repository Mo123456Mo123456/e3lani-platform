# النشر والمراقبة

## متطلبات الإنتاج

- Node.js 22 وPython 3.12.
- PostgreSQL 17 مع PostGIS وpgvector.
- NATS JetStream، Redis، وS3-compatible storage.
- TLS reverse proxy يمرر WebSocket upgrades.
- Secret manager للقيم الحساسة.

غيّر القيم التالية ولا تستخدم أمثلة Docker:

```text
NODE_ENV=production
APP_ENV=production
WORLD_STORE=postgres
JWT_SECRET=<32+ random chars>
INTERNAL_SERVICE_TOKEN=<random>
CORS_ORIGINS=https://world.example
AI_PROVIDER=<openai|anthropic|gemini|local>
```

سيمنع API البدء بـMemory Store في الإنتاج، وسيمنع AI Orchestrator مزود Sandbox.

## ترتيب النشر

1. PostgreSQL وNATS وRedis والتخزين.
2. Job وحيد لـ`db:migrate`.
3. Job اختياري ومدروس لـ`db:seed` في بيئة Sandbox فقط.
4. AI Orchestrator داخل شبكة الخدمات.
5. API ثم notification worker.
6. الويب والإدارة؛ لا تنشر رابط الإدارة في تنقل المستخدم.

## Health checks

- API: `/health`
- AI: `/health`
- NATS: `:8222/healthz`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`

## Telemetry

السجلات الحالية JSON وتحتوي request ID وlatency وstatus. متغير `OTEL_EXPORTER_OTLP_ENDPOINT` محجوز للـcollector. قبل SLO إنتاجي، أضف instrumentation الخاص بـHTTP وPostgreSQL وNATS إلى كل خدمة، ثم لوحات:

- زمن Tick وعدد أحداثه.
- WebGL FPS/فشل context من analytics العميل.
- p50/p95/p99 لـAPI.
- اتصالات PostgreSQL والاستعلامات البطيئة.
- JetStream consumer lag.
- AI tokens/cost/latency/failures.
- WebSocket clients وdelta rate.

## تنبيهات

- لا توجد دورة ناجحة ضمن النافذة المتوقعة.
- consumer lag يتجاوز حدًا تشغيليًا.
- AI error rate أو التكلفة ترتفع.
- DB p95 أو saturation يرتفع.
- WebGL context loss يتجاوز baseline.

## الأمن

- ضع CSP الواجهة في reverse proxy مع nonces؛ API يستخدم Helmet و`default-src 'none'`.
- حدّد حجم body إلى 64KB، وافحص أي upload في خدمة ملفات منفصلة قبل S3.
- نفّذ rate limits موزعة عبر Redis عند تشغيل أكثر من API instance.
- دوّر مفاتيح JWT مع `kid`/JWKS بدل مفتاح HS256 وحيد عند التوسع.
- راجع AuditLog لعمليات pause/rollback وتغييرات الأدوار.
- اختبر الاستعادة والـrollback في staging قبل الإنتاج.
