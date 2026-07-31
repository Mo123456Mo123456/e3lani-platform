# كوكب يولد أمامك — A Planet Is Born Before You

> **عالمك، قرارك، أثر لا ينتهي.**
> *Your world, your call, an endless trace.*

منصة ويب حيّة تعرض كوكبًا ثلاثي الأبعاد يتطور باستمرار. كل مستخدم يضيف عنصرًا واحدًا
(مخلوق، نبات، مورد، حضارة، اختراع، مرض، قانون عالمي…) فيحلله الذكاء الاصطناعي إلى
خصائص منظمة، ثم يشغّله **محرك محاكاة سببي حتمي** يحدد آثاره عبر آلاف السنين داخل
العالم — البيئة والمناخ والحضارات والحروب والاقتصاد — مع تتبع كامل للسببية.

A living web platform rendering an ever-evolving 3D planet. Each user adds one
element; AI structures it, then a **deterministic causal simulation engine**
computes its consequences across millennia — with full causal tracing.
**The AI never invents results; the algorithms decide, the AI explains.**

---

## لماذا هذا المشروع مختلف؟ / Why it is different

| المبدأ | التنفيذ الفعلي |
|---|---|
| لا واجهات شكلية | محرك محاكاة حقيقي (٤٠+ اختبارًا يثبت الحتمية وإعادة التشغيل) |
| الذكاء الاصطناعي لا يختلق | النتائج من الخوارزميات أولاً؛ النموذج اللغوي يشرح فقط مع فلتر «التأسيس» الذي يحذف أي جملة تذكر حقائق غير موجودة |
| لا ربط بمزود واحد | محولات OpenAI / Anthropic / Gemini / Mock — عند غياب المفاتيح يعمل Sandbox موسوم بوضوح |
| حتمية كاملة | نفس الـ Seed يعيد إنتاج نفس التاريخ بتّةً (checksum-verified) |
| كل حدث له سبب | سجل أحداث بسلسلة تجزئة + رسم سببي قابل للاستعلام |
| العربية أولاً | RTL كامل، قاموس عربي/إنجليزي، تبديل فوري |

## المعمارية / Architecture

```
apps/
  web/      الواجهة الرئيسية (Next.js + React Three Fiber + WebGL2)
  admin/    لوحة الإدارة المستقلة (غير مرتبطة من الواجهة العامة)
services/
  api/                NestJS — مصادقة JWT + تدوير Refresh، RBAC، WS، استمرارية
  simulation-engine/  Fastify — سلطة المحاكاة الحية (ticks، تطبيق الإضافات، rollback)
  ai-orchestrator/    Fastify — تحليل الإضافات، التوازن، الإشراف، السرد المؤسس
  world-generator/    توليد كواكب جديدة عند الطلب
  notification-worker/ يحوّل أحداث المساهمات إلى إشعارات
  realtime-gateway/   مُدمج حاليًا داخل api (انظر README داخله — غير مفعّل كعملية)
packages/
  shared-types/       العقود المشتركة (enums, events, DTOs)
  simulation-models/  قلب المحرك — RNG حتمي، توليد الكوكب، الأنظمة السبعة، Monte Carlo
  validation/         مخططات Zod للمدخلات ومخرجات AI المنظمة
  ui/                 نظام التصميم المشترك
  config/             إعدادات ونقاط اتصال مشتركة
  analytics/          تتبع مقاييس غير حساسة
```

التفاصيل: [docs/architecture.md](docs/architecture.md) ·
[محرك المحاكاة](docs/simulation-engine.md) ·
[ربط الذكاء الاصطناعي](docs/ai-integration.md) ·
[قاعدة البيانات](docs/database.md) ·
[واجهات API وWebSocket](docs/api.md)

## التشغيل السريع / Quick start

### أ) Docker Compose (الطريق الكامل)

```bash
cd planet
cp .env.example .env
docker compose up -d --build db simulation-engine ai-orchestrator api web admin notification-worker
docker compose up -d migrate
docker compose --profile setup run --rm seed   # يولّد الكوكب التجريبي (دقائق)
```

- الواجهة: http://localhost:3000 · الإدارة: http://localhost:3100 · API: http://localhost:4000/health

### ب) تطوير محلي (بدون Docker)

```bash
cd planet
pnpm install
pnpm build:packages
pnpm --filter @planet/api exec prisma generate

# طرفيات منفصلة:
pnpm --filter @planet/simulation-engine dev     # :4100
pnpm --filter @planet/ai-orchestrator dev       # :4200
pnpm --filter @planet/api dev                   # :4000 (يحتاج PostgreSQL)
pnpm --filter @planet/web dev                   # :3000
```

> الواجهة تعمل أيضًا **بدون أي خادم**: عند تعذر الوصول للـ API تنتقل لوضع
> «المعاينة المحلية» موسومًا بوضوح، وتولّد الكوكب نفسه داخل المتصفح بنفس حزمة
> المحرك — بيانات حقيقية من نفس الكود، لا Mock.

### الاختبارات / Tests

```bash
pnpm -r run test        # ٤٥+ اختبارًا: حتمية، إعادة تشغيل، سببية، توازن، إشراف، RBAC…
pnpm -r run typecheck
```

## حسابات Sandbox (في هذا الملف فقط — غيّرها فورًا في أي بيئة حقيقية)

| الحساب | البريد | كلمة المرور | الدور |
|---|---|---|---|
| Super Admin | `admin@planet.local` | `Planet#Admin1` | super_admin |
| مستخدم تجريبي | `explorer@planet.local` | `Planet#Explorer1` | explorer |

## الكوكب التجريبي / Demo planet

البذر ينتج تلقائيًا عبر المحرك (1000 نبضة = 5000 سنة): **12 حضارة، ~96 مدينة،
120 موردًا، 370+ نوع مخلوقات، 1100+ نوع نباتات، 51 تقنية، 17 حربًا، 3 تحالفات،
8 طرق تجارة، 6 أوبئة، ~130 ألف حدث** متسلسل سببيًا قابل للاستعلام من
`/worlds/demo-world/events` و`/worlds/demo-world/causal/:seq`.

## تدفق المستخدم الكامل / User journey (section 32)

تسجيل → دخول → تدوير الكوكب وتكبيره → نقر منطقة لبياناتها → «أضف عنصرًا» →
الفئة → الوصف → تحليل AI (خصائص + مخاطر + توازن) → اختيار منطقة البداية →
محاكاة أولية Monte Carlo (١/١٠/١٠٠/١٠٠٠ سنة) → تأكيد → تطبيق في العالم →
أحداث حقيقية في قاعدة البيانات → تغيّر بصري → سجل الأحداث → الخط الزمني →
إشعارات لاحقة («انتشر نباتك إلى قارة جديدة») → خريطة سببية `/worlds/:id/causal/:seq`.

## القرارات الهندسية الموثقة / Documented engineering decisions

1. **TypeScript موحّد** بدل Python/FastAPI لمحرك المحاكاة في هذه المرحلة: حزمة
   `simulation-models` نقية بدون تبعيات، تعمل في Node والمتصفح معًا (هذا ما يمكّن
   المعاينة المحلية الحقيقية)، واختبارها بنفس الأداة. المحرك منفصل خدمةً (HTTP) —
   واستبداله بخدمة Python لاحقًا لا يغيّر أي عقد. (القسم ٥ يسمح بإطار مماثل.)
2. **realtime-gateway مُدمج** في api حاليًا؛ مسار الفصل عبر NATS موثق في مجلده — موسوم صراحةً كغير منفصل.
3. **Event bus داخلي** (in-process fan-out) في التطوير؛ NATS JetStream جاهز في compose للتوسع الأفقي.
4. **pgvector**: عمود `embedding` موجود في `WorldEvent`؛ البحث الدلالي يُفعّل عند توفر مزود تضمين.
5. **OAuth (Google/Apple)**: محوّل موثق غير مفعّل حتى تُضاف المفاتيح — تسجيل البريد يعمل كاملًا الآن.

## الأمان / Security

JWT قصير العمر + Refresh Token Rotation بكشف إعادة الاستخدام (إبطال عائلة الرموز)،
RBAC بعشرة أدوار، Rate limiting (عام + للإضافات + للمصادقة)، كوكيز HttpOnly
SameSite=strict، تحقق Zod لكل مدخل، فحص Prompt Injection وكشف الشيفرة المهربة،
ترويسات أمان + CSP، سجل تدقيق كامل، سلسلة تجزئة للأحداث ضد العبث.
التفاصيل: [docs/security.md](docs/security.md)

## الأداء / Performance

جودة عرض رباعية (فائقة/عالية/متوسطة/توفير طاقة) تغيّر دقة الكرة وDPR والمؤثرات،
DataTextures بدل خامات صور، تحميل كسول لثلاثي الأبعاد (خارج الحزمة الأولى)،
Ring buffer لواجهة الأحداث (٢٠ ألف حدث دون تدهور — مُختبَر)، Delta updates عبر WS.
الأهداف والقياسات: [docs/performance.md](docs/performance.md)

## حالة الاكتمال / Completion status — بصدق

| المكوّن | الحالة |
|---|---|
| محرك المحاكاة الحتمي + توليد الكوكب | ✅ مكتمل ومُختبَر |
| توليد الكوكب (تضاريس/مناخ/أنهار/بيومات/موارد) | ✅ مكتمل |
| النظم البيئية/الحضارات/حروب/اقتصاد/هجرات/أمراض | ✅ مكتمل (مبسّط لكن سببي وحقيقي) |
| تدفق الإضافة + Monte Carlo | ✅ مكتمل |
| AI adapters + توازن + إشراف + سرد مؤسس | ✅ مكتمل (Sandbox بلا مفاتيح) |
| واجهة الكوكب ثلاثية الأبعاد + طبقات + نقر المناطق | ✅ مكتملة |
| المصادقة + RBAC + WS + إشعارات + إدارة | ✅ مكتملة |
| قاعدة البيانات + ترحيلات + بذر | ✅ مكتملة |
| مؤثرات برق/شفق/دخان متقدمة | ⚠️ غير مفعّلة (طبقة السحب والغلاف والأضواء الليلية فعّالة) |
| Web Workers لتوليد الخامات | ⚠️ غير مفعّل (توليد المتصفح حاليًا على الخيط الرئيسي بحجم مضبوط) |
| OAuth Google/Apple | ⚠️ محوّل غير مفعّل بلا مفاتيح |
| NATS event bus | ⚠️ جاهز في compose، الفصل غير مفعّل |
| البحث الدلالي pgvector | ⚠️ العمود موجود، الاستعلامات تُفعّل مع مزود تضمين |
| مراقبة OpenTelemetry كاملة | ⚠️ Health checks + مقاييس أساسية؛ التتبع الكامل غير مفعّل |

## النشر / Deployment

انظر [docs/deployment.md](docs/deployment.md) — بناء الصور، متغيرات البيئة
الإلزامية للإنتاج، ترتيب الإقلاع (migrate → seed → services)، وملاحظات التوسع.

---

Built as a monorepo: pnpm workspaces · TypeScript strict · Next.js · NestJS ·
Fastify · React Three Fiber · Prisma/PostgreSQL(+PostGIS/pgvector) · Docker Compose.
