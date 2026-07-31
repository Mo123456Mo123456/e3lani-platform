<div dir="rtl">

# كوكب يولد أمامك

> **عالمك، قرارك، أثر لا ينتهي.**

منصة ويب حيّة تعرض كوكبًا ثلاثي الأبعاد يتطور باستمرار. كل مستخدم يضيف عنصرًا واحدًا — مخلوق، نبات، مورد، حضارة، اختراع… — ثم يشغّل **محرك محاكاة حتمي** (وليس مجرد نموذج لغوي) آلاف السنوات من التاريخ داخل العالم: المناخ، الأنظمة البيئية، الحضارات، الحروب، التحالفات، الأمراض، الاقتصاد — كلها تتفاعل سببيًا، وكل حدث موثّق بسلسلة أسباب قابلة للتتبع.

الذكاء الاصطناعي هنا **يفهم فكرتك ويشرح النتائج** فقط؛ أما النتائج نفسها فتُحسب خوارزميًا.

---

## التشغيل السريع

### المتطلبات

- Node.js 22+ و pnpm 9 (`corepack enable`)
- Python 3.12+
- PostgreSQL 16 مع PostGIS + pgvector (أو Docker)

### أ) عبر Docker Compose (الأسهل)

```bash
cp .env.example .env            # عدّل الأسرار
docker compose up -d            # postgres, redis, nats, minio, engine, ai, api, web, admin
docker compose exec api pnpm run db:seed   # توليد الكوكب التجريبي + 180 سنة تاريخ
```

ثم افتح:
- **المنصة**: http://localhost:3000
- **لوحة الإدارة**: http://localhost:3001 (غير مرتبطة من واجهة المستخدم)
- **API + OpenAPI**: http://localhost:4000/docs

### ب) يدويًا (تطوير)

```bash
# 1) القاعدة
psql -c "CREATE DATABASE planet_born; CREATE EXTENSION postgis; CREATE EXTENSION vector;" planet_born 2>/dev/null || true

# 2) بايثون: محرك المحاكاة + منسّق الذكاء
python3 -m venv .venv
./.venv/bin/pip install -r services/simulation-engine/requirements.txt -r services/ai-orchestrator/requirements.txt
(cd services/simulation-engine && ../../.venv/bin/uvicorn app.main:app --port 8001) &
(cd services/ai-orchestrator   && ../../.venv/bin/uvicorn app.main:app --port 8002) &

# 3) Node: الباقات + API
pnpm install
pnpm -r --filter "./packages/*" run build
export DATABASE_URL=postgres://planet:planet@localhost:5432/planet_born
export JWT_ACCESS_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
pnpm --filter @planet/api run db:migrate
pnpm --filter @planet/api run db:seed      # يولّد الكوكب ويحاكي 180 سنة (دقائق)
pnpm --filter @planet/api run dev          # :4000

# 4) الواجهات
pnpm --filter @planet/web run dev          # :3000
pnpm --filter @planet/admin run dev        # :3001
```

### حسابات Sandbox (للتطوير فقط — غيّرها في الإنتاج)

| الحساب | البريد | كلمة المرور |
|---|---|---|
| Super Admin | `admin@planet.local` | `PlanetAdmin!234` |
| مستخدم تجريبي | `demo@planet.local` | `PlanetDemo!234` |

> الكوكب التجريبي: **12 حضارة، ~40 مدينة، 120 رواسب موارد، 300 نوع مخلوق، 800 نوع نبات، 50+ تقنية، 180 سنة تاريخًا محاكىً** — كله ناتج من المحاكاة الحتمية (seed=42)، وليس بيانات مُختلقة.

---

## ماذا يحدث عندما تضيف عنصرًا؟

1. تكتب فكرتك حرًّا (عربي/إنجليزي): «شجرة عملاقة تمتص التلوث وتضيء في الليل».
2. **الإشراف**: فحص محتوى ثابت + كشف حقن Prompt/SQL — قبل أي نموذج.
3. **التحليل**: المزوّد (Mock Sandbox افتراضيًا، أو OpenAI/Anthropic/Gemini عند توفر مفاتيح) يحوّلها إلى خصائص رقمية منظّمة ومُتحقق منها.
4. **التوازن**: ميزانيات قوة + ضرائب توازن؛ الأفكار الخارقة تُعاد صياغتها بنسخة متوازنة بدل الرفض المباشر.
5. **التقييم الخوارزمي**: المحرك يحسب احتمالية النجاح والبيئات المناسبة والمخاطر.
6. **المحاكاة المستقبلية**: مسارات مونت كارلو بعد 1/10/100 سنة → الأكثر احتمالًا/الأفضل/الأسوأ + عدم اليقين.
7. **الإطلاق**: يُحقن العنصر في الحالة الفعلية؛ تُخزَّن الأحداث الجذرية بربط سببي بمساهمتك.
8. **الأثر**: مع كل تطور لاحق مرتبط بعنصرك (حرب بسببه، انقراضه، طريق تجارة من مورده…) يصلك إشعار فوري عبر WebSocket، وتتبعه في صفحة الأثر والخريطة السببية.

## المعمارية (مختصر)

| الطبقة | التقنية | الدور |
|---|---|---|
| `apps/web` | Next.js 15, React Three Fiber, GLSL | كوكب حي 3D، طبقات، خط زمني، معالج الإضافة، RTL كامل |
| `apps/admin` | Next.js | إدارة، مراقبة، تحكم بالمحاكاة، مراجعة إشراف |
| `services/api` | NestJS, Kysely, Socket.IO | REST، مصادقة JWT+تدوير، RBAC، WebSocket، تنسيق |
| `services/simulation-engine` | Python FastAPI (حساب خالص) | توليد الكوكب، Ticks حتمية، Event Sourcing، مونت كارلو |
| `services/ai-orchestrator` | Python FastAPI | تحليل النص → منظم، توازن، سرد مُتحقق، مزوّدون قابلون للتبديل |
| PostgreSQL | +PostGIS +pgvector | الحالة، الأحداث، السببية، Snapshots، الذاكرة الدلالية |
| Redis/NATS | اختياريان | ناقل أحداث (بديل داخلي مدمج للتطوير الأحادي) |

التفاصيل: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/SIMULATION.md`](docs/SIMULATION.md) · [`docs/AI.md`](docs/AI.md) · [`docs/DATABASE.md`](docs/DATABASE.md) · [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`docs/WEBSOCKETS.md`](docs/WEBSOCKETS.md)

## الاختبارات

```bash
# 66 اختبار بايثون (حتمية، ثوابت، حقن، سيناريوهات، خرائط، عقود HTTP)
(cd services/simulation-engine && ../../.venv/bin/python -m pytest)
(cd services/ai-orchestrator   && ../../.venv/bin/python -m pytest)

# اختبارات TypeScript (باقات + API)
pnpm -r run test

# فحص قبول شامل بعد الإقلاع (رحلة المستخدم §32 كاملة)
bash services/api/scripts/acceptance.sh http://localhost:4000
```

## القرارات الهندسية الصادقة

- **مزوّد الذكاء الافتراضي Mock/Sandbox** — موسوم بوضوح في الاستجابات والواجهة (`sandbox: true`)؛ لا نعرضه كذكاء إنتاجي. عند إضافة مفاتيح OpenAI/Anthropic/Gemini يُستخدم المزوّد الحقيقي تلقائيًا مع بقاء التحقق نفسه.
- **OAuth (Google/Apple)** موصول عبر JWKS لكنه معطّل بدون مفاتيح (`oauth_not_configured`).
- **بعض خدمات البنية (NATS, MinIO)** مُعدّة في Compose لكن الناقل الداخلي يكفي للعقدة الواحدة؛ الموصّلية موثقة في `docs/ARCHITECTURE.md`.
- **OTP** ليس مفعّلًا في هذه النسخة (مُخطط — موثق في `docs/SECURITY.md`).

---

</div>

# A Planet Being Born Before You

> **Your world, your call, an endless echo.**

A living web platform showing a continuously evolving 3D planet. Each user adds one element — a creature, plant, resource, civilization, invention — and a **deterministic simulation engine** (not just an LLM) plays out centuries of history: climate, ecosystems, civilizations, wars, alliances, diseases, and economy interact causally, and every event is traceable through a causal graph.

AI is used to **understand your idea and narrate outcomes**; the outcomes themselves are computed algorithmically.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up -d
docker compose exec api pnpm run db:seed
```

- Platform: http://localhost:3000
- Admin: http://localhost:3001 (unlinked from the user UI)
- API + OpenAPI: http://localhost:4000/docs

**Sandbox accounts (dev only)**: `admin@planet.local / PlanetAdmin!234`, `demo@planet.local / PlanetDemo!234`.

## Manual dev setup

1. PostgreSQL 16 + PostGIS + pgvector, `CREATE DATABASE planet_born`
2. `python3 -m venv .venv && ./.venv/bin/pip install -r services/*/requirements.txt` then run both FastAPI services (`simulation-engine:8001`, `ai-orchestrator:8002`)
3. `pnpm install && pnpm -r --filter "./packages/*" run build`
4. `pnpm --filter @planet/api run db:migrate && pnpm --filter @planet/api run db:seed && pnpm --filter @planet/api run dev`
5. `pnpm --filter @planet/web run dev` and `pnpm --filter @planet/admin run dev`

## Repository layout

```
apps/web            Next.js 15 — living 3D planet (R3F + custom GLSL), AR/EN RTL
apps/admin          Next.js — ops console (users, sim control, moderation, AI cost)
services/api        NestJS — REST, JWT+rotation auth, RBAC, Socket.IO, orchestration
services/simulation-engine   Python — deterministic world generation & ticks
services/ai-orchestrator     Python — provider adapters, structured output, balance, narration
packages/shared-types        Contracts (events, DTOs, wizard, WS)
packages/validation          Shared zod schemas
packages/simulation-models   TS noise/biomes/geo + offline fallback planet
packages/ui                  Design system (dark mission-control, RTL-safe)
packages/config, analytics, api-client
docs/               Architecture, database ERD, simulation, AI, security, deployment
infra/              Dockerfiles + postgres init
docker-compose.yml  Full local stack
```

## License

Proprietary — internal project.
