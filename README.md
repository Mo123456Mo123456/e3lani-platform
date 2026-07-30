<div dir="rtl">

# كوكب يولد أمامك — Planet Genesis

**عالمك، قرارك، أثر لا ينتهي.**

منصة ويب حيّة: كوكب ثلاثي الأبعاد يتولّد إجرائيًا من بذرة (Seed) ويتطور عبر محرك
محاكاة سببية **حتمي**. كل مستخدم يضيف عنصرًا واحدًا — مخلوقًا، نباتًا، موردًا،
حضارة، اختراعًا، مرضًا… — فيحلله الذكاء الاصطناعي إلى خصائص منظمة، وتتحقق
خوارزمية التوازن منه، ثم يدخل العالم فعليًا وتتفرع آثاره عبر آلاف السنين:
سلاسل غذائية، حروب، تحالفات، طرق تجارة، هجرات، أوبئة، تغير مناخي — وكل حدث
موثق بسببه في سجل أحداث قابل لإعادة التشغيل بالكامل.

> النتائج الأساسية تنتج من **محرك خوارزمي حتمي**، ويُستخدم الذكاء الاصطناعي
> فقط لفهم إضافتك، واقتراح التوازن، وصياغة ما حدث فعلًا — وهو ممنوع من ذكر
> أي حدث غير موجود في بيانات المحاكاة (طبقة السرد مقيدة بقائمة سماح سببية).

---

## لمحة سريعة عن الإمكانات

- **كوكب إجرائي حتمي**: تضاريس، أنهار، ظل مطر، 12 منطقة حيوية، موارد — يتولّد
  من نفس البذرة عند الخادم وفي متصفحك (عبر Web Worker) بتطابق تام.
- **محرك Ticks حتمي + Event Sourcing**: كل تغيّر حدث موثق بأسبابه؛ Snapshots
  وإعادة تشغيل حتمية؛ Rollback إلى أي لحظة — مع إعادة تطبيق إضافات المستخدمين
  بترتيبها أثناء الـ replay.
- **أنظمة محاكاة سببية**: مناخ (Cellular Automata + إجبار احتباسي/بركاني)،
  نظام بيئي (Lotka–Volterra + Carrying Capacity + طفرات + انقراضات)، حضارات
  (Utility AI + ذاكرة عداوات)، حروب مؤسّسة على أسباب محسوبة، اقتصاد وطرق
  تجارة عبر A*‎، أوبئة تنتقل عبر التجارة.
- **محرك توازن**: يمنع العناصر الخارقة ويقترح نسخة متوازنة بدل الرفض.
- **سيناريوهات مونت كارلو**: «ماذا سيحدث بعد إضافتك؟» — أفضل/أسوأ/أرجح
  سيناريو + درجة عدم يقين + عوامل حاسمة (TS في العملية، وخدمة FastAPI علمية
  للدفعات الثقيلة مع RNG متطابق بين اللغتين بت).
- **سرد مقيّد**: يحوّل نتائج المحاكاة إلى قصة دون اختلاق أحداث.
- **وقت حقيقي**: WebSocket بثّ أحداث + Delta Updates فقط (لا إعادة تحميل).
- **واجهة عربية RTL / إنجليزية LTR** بتحويل كامل، ولوحة إدارة محمية مستقلة.

---

## التشغيل السريع (وضع Sandbox — بلا أي مفاتيح خارجية)

المتطلبات: Node ≥ 20، pnpm 9، Python 3.12 (اختياري للخدمات البايثونية).

```bash
pnpm install

# الطرفية 1 — الـ API (مخزن داخلي في الذاكرة؛ كوكب افتراضي بتاريخ 300 سنة)
pnpm --filter @planet/api dev        # http://localhost:4100  (Swagger على /docs)

# الطرفية 2 — الواجهة
pnpm --filter @planet/web dev        # http://localhost:3000

# الطرفية 3 — لوحة الإدارة
pnpm --filter @planet/admin dev      # http://localhost:3100
```

اختياري — الخدمات البايثونية:

```bash
python3 -m venv .venv && .venv/bin/pip install -r services/ai-orchestrator/requirements.txt
.venv/bin/uvicorn app.main:app --app-dir services/ai-orchestrator --port 8100
.venv/bin/uvicorn app.main:app --app-dir services/simulation-engine --port 8200
# ثم فعّل الربط في الـ API: AI_ORCHESTRATOR_URL=http://localhost:8100 SIM_ENGINE_URL=http://localhost:8200
```

### حسابات Sandbox (توثيقية، تُنشأ تلقائيًا عند الإقلاع)

| الحساب | كلمة المرور | الدور |
|---|---|---|
| `admin@planet.local` | `planet-admin-2026` | Super Admin (إدارة + محاكاة + إشراف) |
| `explorer@planet.local` | `planet-explorer-2026` | مستكشف |

> عند غياب مفاتيح الذكاء الاصطناعي يعمل **محلل Sandbox حتمي** (وسم `provider: mock`
> في كل استجابة). لا تُعرض نتائج وهمية على أنها ذكاء اصطناعي حقيقي.

### التشغيل الكامل عبر Docker

```bash
docker compose up --build
# postgres + api(:4100) + ai-orchestrator(:8100) + simulation-engine(:8200)
# + web(:3000) + admin(:3100) — مع AUTO_TICK يجعل العالم يتنفس تلقائيًا
```

للتخزين الحقيقي بلا Docker: شغّل PostgreSQL ثم:

```bash
DATABASE_URL=postgres://planet:planet@localhost:5432/planet_genesis pnpm --filter @planet/api migrate
DATABASE_URL=postgres://... pnpm seed   # الكوكب التجريبي الكامل (انظر أدناه)
DATABASE_URL=postgres://... pnpm --filter @planet/api start
```

---

## الكوكب التجريبي (بيانات Seed حقيقية)

`pnpm seed` يبني «كوكب التكوين الأول» عبر **المحرك نفسه** (ليس بيانات جامدة):

- 12 حضارة مؤسِّسة، 300 نوع مخلوق، 800 نبات، 50 تقنية، ‎~140 موردًا
- 400 نبضة (2000 سنة) من التاريخ: حروب، تحالفات، هجرات، انقراضات، اكتشافات
- كل الأحداث في `world_events` + لقطات كل 25 نبضة للـ Rollback
- بدون `DATABASE_URL` يكتب `data/seed-planet.json`

---

## معمارية المشروع

```mermaid
flowchart LR
  subgraph Clients
    WEB[apps/web<br>Next.js + R3F]
    ADMIN[apps/admin<br>Vite + React]
  end
  subgraph Services
    API[services/api<br>Fastify REST + WS]
    AIO[services/ai-orchestrator<br>FastAPI]
    SIM[services/simulation-engine<br>FastAPI علمية]
  end
  subgraph Packages
    MODELS[packages/simulation-models<br>المحرك الحتمي المرجعي]
    TYPES[shared-types] VALID[validation] CFG[config] AN[analytics] UI[ui]
  end
  DB[(PostgreSQL<br>29 جدولًا + event store)]
  WEB -->|REST / WS| API
  ADMIN -->|/api proxy| API
  API --> MODELS
  API -->|HTTP عند توفره| AIO
  API -->|HTTP عند توفره| SIM
  API --> DB
  WEB -->|يولّد نفس الشبكة من البذرة| MODELS
```

```
apps/
  web/            الواجهة الرئيسية (كوكب 3D، معالج الإضافة، الخط الزمني)
  admin/          لوحة الإدارة المحمية (محاكاة، مستخدمون، إشراف، تكلفة AI)
services/
  api/            REST + WebSocket + WorldManager + مستودعات (ذاكرة/Postgres)
  ai-orchestrator/   محلل الإضافات + محوّلات OpenAI/Anthropic/Gemini/Mock
  simulation-engine/ مونت كارلو علمي للتحليلات الثقيلة (RNG متطابق مع TS)
  realtime-gateway/  (README: منفذ حاليًا كوحدة داخل api — غير منفصل بعد)
  world-generator/   (README: منفذ كمكتبة مشتركة — ليس خدمة مستقلة)
  notification-worker/(README: منفذ داخل api — قنوات إضافية غير مفعلة)
packages/
  simulation-models/ RNG + noise + worldgen + engine + balance + scenarios
  shared-types/      المفردات الموحدة  validation/ مخططات zod
  config/            بيئة مُنمّطة       analytics/ تتبع غير حساس
  ui/                عناصر تصميم مشتركة
```

---

## الاختبارات

```bash
pnpm test                 # vitest لكل الحزم (محرك + API)
pnpm test:python          # pytest للخدمتين البايثونيتين
node scripts/load-test.mjs 15 12   # اختبار حمل (p50/p90/p99 + معدل أخطاء)
```

الحزمة الحالية: **30 اختبار محرك** (حتمية، replay، rollback مع إضافات،
ثوابت فيزيائية لأي seed، توازن، سيناريوهات) + **15 اختبار API** (مصادقة،
RBAC، إشراف، الرحلة الكاملة من التسجيل إلى الـ Rollback، WebSocket) +
**20 اختبار بايثون** (Structured Output، مزودون بواجهات مقلدة، تطابق RNG
عبر اللغتين، حدود السيناريوهات).

نتيجة قياس الحمل محليًا: ‎~6.5k طلب/ثانية، p99 = 3.9ms، 0% أخطاء
(429 = محدد المعدل يعمل كما صُمم).

---

## وثائق إضافية

- [docs/architecture.md](docs/architecture.md) — المعمارية والقرارات الهندسية
- [docs/simulation-engine.md](docs/simulation-engine.md) — المحرك والخوارزميات
- [docs/ai-orchestration.md](docs/ai-orchestration.md) — طبقات الذكاء الاصطناعي
- [docs/database.md](docs/database.md) — مخطط قاعدة البيانات
- [docs/deployment.md](docs/deployment.md) — النشر والإنتاج

## حالة الميزات (شفافية التفعيل)

| مفعل فعليًا | غير مفعل بعد (موسوم بوضوح) |
|---|---|
| الكوكب 3D بطبقاته الحية، المعالج الكامل، الأحداث الحية، الإشعارات، الخط الزمني، الـ Rollback، السيناريوهات، لوحة الإدارة، Sandbox AI | OAuth بمقدمي Google/Apple (البنية جاهزة: `provider` في المستخدم)، OTP، التسجيل الصوتي، قنوات إشعار خارجية (بريد/دفع)، PostGIS/pgvector (معطلان بتعليق في الهجرة)، NATS bus (profile اختياري)، فصل realtime-gateway كعملية |

---

---

# Planet Genesis — English

**Your world, your call, an endless aftermath.**

A living web platform: a procedurally generated 3D planet that evolves
through a **deterministic causal simulation engine**. Each user adds one
element; the AI parses it into structured traits, an algorithmic balance
gate keeps it fair, and the world engine propagates its consequences for
thousands of years — food webs, wars, alliances, trade routes, migrations,
epidemics, climate shifts — every event carrying its explicit causes in a
replayable event journal.

- Core outcomes come from the **algorithmic engine**, never from the LLM.
- The AI layer (provider-agnostic: OpenAI/Anthropic/Gemini/mock) only parses
  ideas, suggests balance, and narrates **allowlisted real events**.
- Deterministic everywhere: same seed → same history, bit-for-bit replay,
  cross-language RNG parity (TS ⇄ Python).
- Arabic RTL + English LTR, admin console, Swagger at `/docs`, Docker stack.

**Quick start** (sandbox, zero external keys): `pnpm install`, then
`pnpm --filter @planet/api dev` and `pnpm --filter @planet/web dev`.
Sandbox accounts: `admin@planet.local / planet-admin-2026`,
`explorer@planet.local / planet-explorer-2026`.
Full stack: `docker compose up --build`. Tests: `pnpm test` + `pnpm test:python`.

</div>
