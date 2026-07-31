# الأمان / Security

<div dir="rtl">

## المصادقة

- **JWT وصول** (HS256 عبر `jose`، 15 دقيقة، issuer/audience مقيدان) + **Refresh مُدوَّر** عشوائي (48 بايت، مخزن كهاش SHA-256 فقط).
- **كشف إعادة الاستخدام**: استخدام Refresh مُدوَّر سابقًا ⇒ إلغاء العائلة كاملة (`refresh_token_reuse_detected`).
- كلمات المرور **bcrypt(10)** مع مسار مقارنة ثابت الزمن عند غياب المستخدم.
- **Google/Apple OAuth** عبر JWKS من المصدرين؛ معطّل برسالة صريحة بدون مفاتيح (`oauth_not_configured`).
- **OTP**: غير مفعّل v1 — مخطط إضافته على `refresh_tokens` البنية نفسها.

## التخويل (RBAC)

10 أدوار بترتيب رتب (`visitor → super_admin`)؛ `MinRole` decorator + RolesGuard عالميان. الإدارة تتطلب `admin+`؛ ترقية الذات من super_admin ممنوعة.

## حماية المدخلات والمخرجات

- تحقق zod على كل body (pipe مشترك مع الواجهة عبر `@planet/validation`).
- استعلامات Kysely مُعامّمة كلها (لا تجميع SQL يدوي بمدخلات)؛ JSONB عبر معاملات.
- إشراف ثنائي: قواعد ثابتة في API (مسار سريع) + منسّق الذكاء (قبل أي LLM) — حقن prompt/SQL/script/قوالب/spam.
- ترميز المخرجات: JSON فقط من API (لا HTML مولّد من مدخلات المستخدم)؛ React يهرب افتراضيًا.
- لا يوجد أي `eval`/تنفيذ نص مستخدم في المشروع.

## الترويسات والنقل

- CSP صارمة على API (`default-src 'none'`)، `nosniff`, `DENY framing`, `referrer-policy`, `permissions-policy`.
- CORS قائمة سماح (`WEB_URL`, `ADMIN_URL`) مع credentials.
- Rate limiting: تسجيل دخول/تسجيل 10/5د، مساهمات 20/ساعة، معاينات 10/ساعة (نافذة منزلقة؛ Redis للتوسع الأفقي).
- WebSocket: JWT عند المصافحة، غرف per-user/per-planet، لا بث إلا دلتا.

## التدقيق والسرية

- `audit_logs` لكل فعل حساس (دخول، إدارة مستخدمين، تحكم محاكاة، مراجعة إشراف).
- الأسرار عبر البيئة فقط؛ `.env.example` بلا قيم حقيقية؛ `COOKIE_SECURE` في الإنتاج.
- النسخ الاحتياطي والتعافي: انظر DEPLOYMENT.md (pg_dump + اختبار استعادة ربع سنوي).

## قائمة فحص الإنتاج

- [ ] JWT secrets عشوائية 32 بايت+ (وليست قيم .env.example)
- [ ] تغيير كلمتي مرور Sandbox أو حذف الحسابين
- [ ] HTTPS إجباري + `COOKIE_SECURE=true`
- [ ] مفاتيح OAuth/LLM في مدير أسرار (وليس في صورة Docker)
- [ ] سياسة احتفاظ سجلات + مراقبة معدل فشل الدخول
- [ ] مراجعة CSP للواجهة عند إضافة CDN للخطوط

</div>

## English

Short-lived JWT (jose HS256) + rotated opaque refresh tokens with reuse detection and family revocation; bcrypt passwords with timing-safe paths; Google/Apple OAuth via JWKS (disabled without keys). 10-tier RBAC, zod validation everywhere, parameterized queries only, dual-layer moderation before any LLM call, strict CSP, origin allow-list CORS, sliding-window rate limits, JWT-authenticated WebSocket rooms, full audit logging, and secrets via environment only.
