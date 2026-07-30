# كوكب يولد أمامك · Planet Born Before You

**عالمك، قرارك، أثر لا ينتهي.**  
**Your world. Your decision. An endless impact.**

منصة ويب حيّة تعرض كوكبًا ثلاثي الأبعاد يتطور باستمرار. يضيف كل مستخدم عنصرًا واحدًا، فتحسب خوارزميات المحاكاة السببية الأثر المباشر وغير المباشر، ثم يصوغ الذكاء الاصطناعي الشرح دون اختلاق نتائج.

> هذا المستودع يستبدل منصة إعلانات سابقة (`e3lani`) بمنتج محاكاة الكوكب. البنية Monorepo نهائية منذ البداية.

---

## English summary

A full-stack living-planet platform:

| Layer | Tech |
|---|---|
| Web | Next.js, React Three Fiber, Zustand, TanStack Query, AR/EN RTL↔LTR |
| Admin | Next.js (separate app, not linked from public UI) |
| API | NestJS, Prisma, PostgreSQL, Redis, OpenAPI |
| Simulation | Python FastAPI — deterministic ticks, biomes, ecosystem, civs, wars, causal graph |
| AI | Provider adapters (OpenAI / Anthropic / Gemini / **Sandbox**) — parse, balance, narrate only |
| Realtime | WebSocket gateway + Redis deltas |

Simulation decides outcomes. AI explains them. No fake success when services fail.

---

## البنية / Architecture

```
apps/
  web/                 # لوحة الكوكب ثلاثية الأبعاد + تدفق الإضافة
  admin/               # إدارة محمية
services/
  api/                 # NestJS REST + Swagger
  simulation-engine/   # محرك Ticks الحتمي
  ai-orchestrator/     # تحليل / توازن / سرد
  realtime-gateway/    # WebSocket deltas
  world-generator/     # توليد إجرائي
  notification-worker/ # عامل إشعارات
packages/
  db/                  # Prisma schema + seed
  shared-types/
  simulation-models/
  validation/
  config/
  ui/
  analytics/
infra/docker/          # Compose + Dockerfiles
docs/                  # المعمارية والخوارزميات
```

مخططات مفصّلة: [`docs/architecture/overview.md`](docs/architecture/overview.md) · [`docs/algorithms/simulation.md`](docs/algorithms/simulation.md) · [`docs/ai/orchestration.md`](docs/ai/orchestration.md)

---

## التشغيل المحلي / Quick start

### المتطلبات
- Node.js 20+
- pnpm 9.12
- Python 3.12
- PostgreSQL 16 (+ PostGIS إن توفّر)
- Redis 7

### 1) البيئة

```bash
cp .env.example .env
pnpm install
bash scripts/setup-python.sh
```

### 2) قاعدة البيانات

```bash
pnpm --filter @planet/db exec prisma db push
pnpm db:seed
```

أو عبر Docker:

```bash
pnpm docker:up
# ثم migrate + seed
```

### 3) الخدمات

```bash
# طرفية 1 — محاكاة
pnpm dev:sim

# طرفية 2 — ذكاء اصطناعي (Sandbox افتراضيًا)
pnpm dev:ai

# طرفية 3 — API + Realtime + Web
pnpm --filter @planet/api dev
pnpm --filter @planet/realtime-gateway dev
pnpm --filter @planet/web dev
```

- الويب: http://localhost:3000  
- الإدارة: http://localhost:3001  
- API docs: http://localhost:4000/api/docs  
- المحاكاة: http://localhost:8001/docs  
- AI: http://localhost:8002/docs  

---

## حسابات Sandbox

| الدور | البريد | كلمة المرور |
|---|---|---|
| Super Admin | `admin@planet-born.local` | `PlanetAdmin!2026` |
| Explorer | `explorer@planet-born.local` | `Explorer!2026` |

مذكورة هنا للاختبار فقط — غيّرها قبل أي نشر.

---

## تدفق المستخدم المكتمل

1. تسجيل / دخول  
2. فتح الكوكب ثلاثي الأبعاد وتدويره  
3. اختيار فئة عنصر وكتابة فكرة  
4. تحليل Sandbox/AI → خصائص ومخاطر  
5. اختيار منطقة وتأكيد الإضافة  
6. محاكاة سببية تُحفظ في PostgreSQL  
7. ظهور الحدث في السجل والخط الزمني  
8. إشعار بتطور الأثر  

عند غياب مفاتيح AI يعمل **Sandbox Provider** ويُعلَّم بوضوح أنه ليس نموذجًا سحابيًا حقيقيًا.

---

## الاختبارات

```bash
pnpm --filter @planet/validation test
pnpm --filter @planet/simulation-models test
pnpm --filter @planet/api test
pnpm --filter @planet/realtime-gateway test
pnpm test:sim
pnpm test:ai
```

اختبارات المحاكاة تثبت: نفس الـ Seed → نفس التاريخ، والمساهمات تُنتج أحداثًا سببية.

---

## الذكاء الاصطناعي

| المزود | المتغير |
|---|---|
| Sandbox (افتراضي) | `AI_PROVIDER=sandbox` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |

الطبقات: Moderate → Parse (structured) → Balance → (Simulation) → Narrate (حقائق فقط).

---

## الإدارة

التطبيق `apps/admin` منفصل وغير مربوط من واجهة المستخدم العامة. يتطلب دور `system_admin` أو `super_admin`.

---

## النشر

راجع [`docs/architecture/deployment.md`](docs/architecture/deployment.md).  
`infra/docker/docker-compose.yml` يشغّل Postgres (pgvector) وRedis وNATS وMinIO وجميع الخدمات.

---

## الترخيص والحالة

نسخة تطويرية مفتوحة للتجربة المحلية. بعض طبقات المراقبة المتقدمة (OpenTelemetry كامل، Visual Regression) مذكورة كمسارات توسعة وموثّقة كـ inactive عند عدم الربط.
