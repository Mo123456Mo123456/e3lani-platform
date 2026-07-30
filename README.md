<div dir="rtl">

# كوكب يولد أمامك

**عالمك، قرارك، أثر لا ينتهي.**

منصة ويب تعرض كوكبًا ثلاثي الأبعاد حيًا يتطور باستمرار بمحرك محاكاة حتمي. كل مستخدم يضيف عنصرًا واحدًا — مخلوقًا، نباتًا، موردًا، حضارة، اختراعًا، مرضًا، قانونًا عالميًا… — فيحلله الذكاء الاصطناعي إلى خصائص منظمة، تمرّ بطبقة التوازن، ثم يدخل العالم فتنتشر آثاره عبر آلاف السنين المحاكاة: مناخ، نظام بيئي، حضارات، حروب، تحالفات، تجارة، هجرات — وكل حدث موثّق بسلسلة سببية قابلة للتتبع حتى إضافتك.

> النتائج لا يختلقها نموذج اللغة: يحسبها محرك خوارزمي سبباني حتمي (Seed ثابت ⇒ تاريخ ثابت)، والذكاء الاصطناعي يشرحها فقط — ولا يُسمح له بذكر رقم غير موجود في نتائج المحاكاة.

## التشغيل السريع

```bash
# المتطلبات: Node ≥ 20، pnpm 9، Docker (لقاعدة البيانات)
corepack enable
pnpm install

# 1) البنية التحتية: PostgreSQL + Redis
docker compose up -d postgres redis
cp .env.example .env

# 2) قاعدة البيانات + البيانات التجريبية (كوكب حي كامل)
pnpm db:migrate:dev
pnpm db:seed

# 3) التشغيل (4 أطراف طرفية أو خلفيات)
pnpm dev:api      # REST + WebSocket على :4000 — Swagger على /docs
pnpm dev:ai       # منسّق الذكاء الاصطناعي على :4100
pnpm dev:web      # الواجهة على :3000
pnpm dev:admin    # لوحة الإدارة على :3100
```

أو عبر Docker بالكامل (يبني كل شيء ويزرع الكوكب التجريبي):

```bash
docker compose up --build
# الواجهة: http://localhost:3000 — لوحة الإدارة: http://localhost:3100 — API: http://localhost:4000/docs
```

## حسابات Sandbox (بيئة التطوير فقط)

| الحساب | كلمة المرور | الدور |
|---|---|---|
| `admin@kawkab.dev` | `Kawkab#2026` | Super Admin (لوحة الإدارة) |
| `explorer@kawkab.dev` | `Kawkab#2026` | مستخدم عادي |

> تُنشأ هذه الحسابات عبر سكربت الزرع في بيئة التطوير فقط. غيّرها فورًا في أي بيئة حقيقية.

## جرب التدفق الكامل

1. أنشئ حسابًا → افتح الكوكب ودوّره وكبّره.
2. انقر أي منطقة لعرض بياناتها الحية.
3. «أضف عنصرًا واحدًا إلى العالم» → اختر «نبات» → اكتب: **شجرة عملاقة تمتص التلوث وتضيء في الليل**.
4. شاهد التحليل المنظم والخصائص والمخاطر واحتمالية النجاح.
5. اختر موطن الظهور → أطلقها → شاهد العالم يتفاعل فورًا، وسردًا مبنيًا على نتائج المحاكاة حصرًا.
6. شغّل «ماذا سيحدث بعد إضافتك؟» لسيناريوهات 1/10/100/1000 سنة (Monte Carlo).
7. تابع سجل الأحداث المباشر، والخط الزمني، والإشعارات، وخريطتك السببية في لوحة المستخدم.

## بنية المستودع

```
apps/
  web/          Next.js + React Three Fiber — الكوكب الحي (عربي RTL / إنجليزي)
  admin/        لوحة الإدارة المستقلة (RBAC، غير مرتبطة من واجهة المستخدم)
services/
  api/          NestJS — REST + WebSocket + مدير العوالم + المصادقة + الإشعارات
  simulation-engine/  عامل مستقل لتقدّم النبضات (اختياري للتوسع الأفقي)
  ai-orchestrator/    بوابة موحدة لمزودي الذكاء الاصطناعي
packages/
  simulation/   محرك المحاكاة الحتمي + مولّد الكوكب (يعمل في الخادم والمتصفح)
  ai/           محولات المزودين + التحليل المنظم + السرد المؤسَّس + مكافحة الحقن
  shared-types/ العقود المشتركة (Enums + DTO)
  validation/   مخططات Zod
  config/       إعدادات البيئة والثوابت
  ui/           نظام التصميم (tokens + مكونات)
  analytics/    تحليلات خفيفة تراعي الخصوصية
```

## الاختبارات

```bash
pnpm build   # بناء الحزم بالترتيب الطوبولوجي
pnpm test    # كل الاختبارات (الحتمية، السببية، التوازن، التأسيس، المصادقة…)
```

اختبارات إلزامية مغطاة: ثبات التاريخ لنفس الـSeed، إعادة التشغيل، عدم وجود حدث بلا سبب، سقف السكان، مشروعية الهجرات، رفض/ترويض العناصر الكاسرة، الاسترجاع إلى أي Snapshot، منع الذكاء الاصطناعي من اختلاق نتائج. التفاصيل في [docs/testing.md](docs/testing.md).

## الوثائق

| الملف | المحتوى |
|---|---|
| [docs/architecture.md](docs/architecture.md) | مخطط المعمارية + قرارات هندسية (ADR) |
| [docs/simulation-engine.md](docs/simulation-engine.md) | محرك النبضات والحتمية وEvent Sourcing |
| [docs/algorithms.md](docs/algorithms.md) | الخوارزميات: توليد الكوكب، البيئة، البيئة الحيوية، الحضارات، الحروب |
| [docs/ai-integration.md](docs/ai-integration.md) | طبقات الذكاء الاصطناعي والتأسيس والـSandbox |
| [docs/database.md](docs/database.md) | مخطط قاعدة البيانات (ER) |
| [docs/api.md](docs/api.md) | REST + WebSocket |
| [docs/deployment.md](docs/deployment.md) | النشر، Docker، CI/CD، النسخ الاحتياطي |
| [docs/roadmap.md](docs/roadmap.md) | حالة كل ميزة بصدق (مفعّل / غير مفعّل بعد) |

## ملاحظات شفافية

- بدون مفاتيح مزودي الذكاء الاصطناعي يعمل **المحلل الحتمي المحلي (Sandbox)** وتظهر شارة صفراء في الواجهة — لا نعرض نتائج وهمية على أنها ذكاء اصطناعي حقيقي.
- تسجيل الدخول عبر Google/Apple مسجل كمحولات لكنه يعيد `501` حتى تُهيأ المفاتيح.
- كل تأثير بصري على الكوكب مصدره بيانات المحاكاة نفسها (نفس الكود يولّد الخامات في المتصفح ويحاكي في الخادم).

---

</div>

# A Planet Born Before You

**Your world, your call, an echo that never ends.**

A web platform showing a living 3D planet that evolves continuously under a deterministic simulation engine. Each user adds one element — a creature, plant, resource, civilization, invention, disease, world law… — the AI parses it into structured traits, a balance layer keeps it fair, and the element enters the world. Its consequences then unfold over millennia of simulated time: climate, ecosystems, civilizations, wars, alliances, trade, migrations — every event carrying a traceable causal chain back to your addition.

> Outcomes are not hallucinated by a language model: they are computed by a deterministic causal engine (fixed seed ⇒ fixed history). AI only narrates, and it is forbidden from citing any number that does not exist in the simulation's results.

## Quick start

```bash
corepack enable
pnpm install
docker compose up -d postgres redis
cp .env.example .env
pnpm db:migrate:dev && pnpm db:seed
pnpm dev:api & pnpm dev:ai & pnpm dev:web & pnpm dev:admin
```

Or fully containerized: `docker compose up --build` → web `:3000`, admin `:3100`, API docs `:4000/docs`.

## Sandbox accounts (dev only)

| Account | Password | Role |
|---|---|---|
| `admin@kawkab.dev` | `Kawkab#2026` | Super Admin |
| `explorer@kawkab.dev` | `Kawkab#2026` | Regular user |

## Highlights

- **Deterministic engine**: seeded RNG forks, event sourcing, snapshots, rollback, causal graph — replay bit-exact history.
- **Procedural planet**: plate tectonics approximation, simplex fBm, rain shadows, rivers, 12 biomes — regenerated identically in the browser worker from the same seed.
- **Agent civilizations**: utility-AI decisions (expand/research/trade/ally/war/migrate/reform), A* pathfinding for routes and refugees, Lotka–Volterra-inspired food webs.
- **Grounded AI**: provider adapters (OpenAI/Anthropic/Gemini/mock sandbox), structured output validation, balance suggestions, narration restricted to simulation facts with automatic fallback.
- **Monte-Carlo futures**: 1/10/100/1000-year scenario forks with uncertainty bands — never false certainty.

Full documentation in [docs/](docs/architecture.md). Feature status (what is live vs explicitly not enabled yet): [docs/roadmap.md](docs/roadmap.md).
