# كوكب يولد أمامك / A Planet Born Before You

**عالمك، قرارك، أثر لا ينتهي.**  
**Your world, your decision, an endless impact.**

منصة ويب حيّة تعرض كوكبًا ثلاثي الأبعاد إجرائيًا يتطور باستمرار. يضيف المستخدم عنصرًا واحدًا، فيحسب **محرك محاكاة سببي حتمي** الآثار، ثم يصوغ الذكاء الاصطناعي شرحًا مرتبطًا بنتائج المحاكاة فقط.

---

## English summary

A production-oriented monorepo for a living procedural planet: deterministic simulation first, AI for structured parsing/narrative second, WebGL globe, realtime events, admin RBAC, Docker, and tests.

---

## المعمارية

```
apps/
  web/                 Next.js + R3F planet dashboard (ar RTL / en LTR)
  admin/               Admin console (not linked from public nav)
services/
  api/                 Fastify REST + OpenAPI + auth + world API
  simulation-engine/   HTTP wrapper around simulation-models
  ai-orchestrator/     Provider adapters (OpenAI/Anthropic/Gemini/Mock)
  realtime-gateway/    WebSocket delta updates
  world-generator/     Procedural generation service
  notification-worker/ Contribution follow-up notifications
packages/
  shared-types/        Zod schemas & enums
  simulation-models/   Seeded RNG, climate, ecology, civs, causal graph
  validation/          Moderation / injection guards
  config/              Brand, ports, balance limits
  ui/                  Shared glass UI primitives
  analytics/           Privacy-aware event buffer
```

محرك المحاكاة **منفصل** عن الواجهة وعن نموذج اللغة. النتائج الرقمية تُحسب خوارزميًا؛ السرد يُقيَّد بأحداث المحاكاة.

تفاصيل إضافية:
- [مخطط المعمارية](./docs/architecture/OVERVIEW.md)
- [محرك المحاكاة](./docs/algorithms/SIMULATION.md)
- [ربط الذكاء الاصطناعي](./docs/architecture/AI.md)
- [مخطط قاعدة البيانات](./docs/architecture/DATABASE.md)

---

## التشغيل السريع (Sandbox بدون Docker)

يتطلب Node.js 22 و`pnpm`.

```bash
pnpm install
pnpm --filter @planet-born/shared-types build
pnpm --filter @planet-born/config build
pnpm --filter @planet-born/validation build
pnpm --filter @planet-born/simulation-models build

# طرفيات منفصلة:
pnpm --filter @planet-born/api dev                 # :4000  (memory mode)
pnpm --filter @planet-born/ai-orchestrator dev     # :4100  (Mock provider)
pnpm --filter @planet-born/realtime-gateway dev    # :4300
pnpm --filter @planet-born/simulation-engine dev   # :4200
pnpm --filter @planet-born/web dev                 # :3000
pnpm --filter @planet-born/admin dev               # :3001
```

بدون `DATABASE_URL` يعمل الـ API في **وضع الذاكرة** مع بذرة تلقائية.

OpenAPI: `http://localhost:4000/docs`

---

## حسابات Sandbox

| الدور | البريد | كلمة المرور |
|---|---|---|
| Super Admin | `admin@planet.born` | `PlanetAdmin!2026` |
| مستكشف | `explorer@planet.born` | `Explorer!2026` |

بيانات الإدارة موثّقة هنا فقط؛ لا تُعرض في واجهة المستخدم العادية.

---

## Docker Compose

```bash
# بنية تحتية فقط إن رغبت بـ Postgres/Redis/MinIO:
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio

export DATABASE_URL=postgres://planet:planet@localhost:5432/planet_born
pnpm --filter @planet-born/api db:migrate
pnpm --filter @planet-born/api db:seed
```

ملفات Docker للخدمات موجودة تحت `infra/docker/`.

---

## متغيرات البيئة

انسخ:

- `.env.example` (جذر)
- `services/api/.env.example`
- `services/ai-orchestrator/.env.example`
- `apps/web/.env.example`
- `apps/admin/.env.example`

عند غياب مفاتيح الذكاء الاصطناعي يُستخدم **MockProvider** مع `sandbox: true` — لا تُعرض النتائج كذكاء اصطناعي إنتاجي.

مزودو الذكاء الاصطناعي المدعومون عبر المحوّلات: `mock` | `openai` | `anthropic` | `gemini`.

---

## تدفق المستخدم الحرج

1. تسجيل / دخول  
2. فتح الكوكب وتدويره وتكبيره (WebGL)  
3. اختيار فئة وكتابة فكرة  
4. تحليل منظم + توازن  
5. اختيار موقع وإضافة للعالم  
6. تشغيل تكات المحاكاة  
7. ظهور أحداث في السجل وقاعدة البيانات / الذاكرة  
8. سيناريوهات مستقبلية (Monte Carlo)  
9. خريطة سببية للأثر  

---

## الاختبارات

```bash
pnpm --filter @planet-born/simulation-models test
pnpm --filter @planet-born/api test
pnpm --filter @planet-born/ai-orchestrator test
```

اختبارات إلزامية مغطاة جزئيًا/كليًا: حتمية الـ Seed، إعادة التشغيل، التوازن، منع السرد المختلق، عدم خلق حضارة بلا سكان.

---

## حالة الميزات

| الميزة | الحالة |
|---|---|
| محرك ticks حتمي + event sourcing في الحالة | مفعّل |
| توليد كوكب إجرائي + مناخ/بيئة/حضارات | مفعّل |
| AI adapters + sandbox | مفعّل (Mock افتراضيًا) |
| كوكب WebGL + طبقات أساسية | مفعّل |
| RTL/LTR | مفعّل |
| لوحة إدارة RBAC | مفعّل |
| PostgreSQL / memory dual mode | مفعّل |
| NATS JetStream / OpenTelemetry كامل | غير مفعّل بالكامل — مهيأ للتوسع |
| OAuth Google/Apple | غير مفعّل — البريد/كلمة المرور فقط حالياً |
| PWA Service Worker | بيان Manifest فقط |

أي مسار غير موصول يُعلَّم بوضوح في الواجهة أو الوثائق.

---

## الترخيص

خاص بمشروع التسليم الحالي.
