# النشر والأمن والتشغيل

## Production checklist

1. عطّل `SANDBOX_MODE` ولا تشغل `002_seed.sql` على قاعدة إنتاج جديدة.
2. ولّد JWT secrets مستقلين بطول 32 بايت على الأقل واحفظهما في secret manager.
3. عيّن `WEB_ORIGIN` و`ADMIN_ORIGIN` إلى HTTPS دقيقين.
4. ضع API و`/metrics` وNATS وPostgreSQL وRedis وMinIO في شبكة خاصة.
5. فعّل TLS عند ingress وNATS/PostgreSQL، وسياسة CORS لا تقبل wildcard.
6. استبدل بيانات MinIO المحلية، أنشئ bucket policy، وفعّل object versioning.
7. جدولة نسخ PostgreSQL base backup + WAL، واختبر الاستعادة دوريًا.
8. ضع rate limits موزعة في Redis قبل التوسع الأفقي.
9. شغّل كاتب محاكاة واحدًا لكل `planetId` أو أضف distributed lock.
10. راقب health، Prometheus metrics، PostgreSQL، NATS consumer lag، تكلفة AI وأخطاء WebGL.

## Controls present

- Argon-compatible bcrypt hashes بكلفة 12 للـSandbox، ولا تُخزن كلمة مرور خام.
- access JWT قصير (15 دقيقة).
- refresh token عشوائي، مخزن كـSHA-256، rotation وعائلة تُلغى عند reuse.
- HttpOnly + Secure في الإنتاج + SameSite Strict.
- Bearer mutations لا تعتمد على cookie؛ endpoints الخاصة بالـrefresh تتحقق من Origin.
- Zod وPydantic يمنعان الحقول والقيم خارج الحدود.
- fixed-rule injection/moderation قبل AI، والنص يرسل كحمولة غير موثوقة.
- SQL parameters عبر Postgres.js؛ لا يوجد تركيب استعلام من مدخل المستخدم.
- Helmet CSP، CORS allow-list، body limit، request rate limit.
- RBAC يتحقق في API حتى لو جرى استدعاؤه دون لوحة الإدارة.
- audit log للمساهمة والـrollback.
- structured logs مع redaction للـAuthorization/cookies/passwords.

## Observability

`/metrics` يعرض:

- Node process defaults.
- `living_planet_http_request_duration_seconds`.
- `living_planet_simulation_events_total{type}`.

لوحات التشغيل المقترحة:

- p95 HTTP latency و5xx ratio.
- زمن Tick وعدد أحداثه من `simulation_ticks`.
- آخر tick ملتزم لكل كوكب؛ نبّه عند توقفه.
- NATS connection/lag وWebSocket clients.
- DB pool wait، locks، slow queries وحجم WAL.
- `ai_requests`: latency، status، tokens وcost.
- client-side FPS/device tier بعد ربط analytics sink بجامع فعلي.

متغير `OTEL_EXPORTER_OTLP_ENDPOINT` محجوز، لكن exporter نفسه غير مفعّل في هذا الإصدار وموسوم كذلك في الواجهة؛ لا يوجد trace وهمي.

## Disaster recovery

- RPO المستهدف يُحدد حسب معدل ticks، مع WAL archiving مستمر.
- Snapshot المحاكاة ليس بديلًا عن backup قاعدة البيانات.
- لاستعادة حادث منطقي: أوقف ticks، استعد DB إلى نسخة معزولة، قارن checksums، ثم حوّل الخدمة.
- rollback داخل لوحة الإدارة يحذف الفرع اللاحق للأحداث والتكات والـsnapshots ويوقف الكوكب. العملية مقصودة ومدققة، ولا ينبغي استخدامها بدل point-in-time recovery.

## CI/CD

Workflow ينفذ TypeScript checks، اختبارات المحرك، اختبار FastAPI، builds، وفحص Compose. صور الإنتاج ينبغي أن تُبنى برقم commit، تُفحص للثغرات، ثم تُنشر تدريجيًا مع migration job وحيد قبل API.
