# كوكب يولد أمامك | A Planet Born Before You

> عالمك، قرارك، أثر لا ينتهي.  
> Your world. Your choice. Endless impact.

منصة Monorepo لمحاكاة كوكب حي حتمي. تولّد الخوارزميات العالم وتدفع تغيراته، وتحفظ النتائج كأحداث سببية في PostgreSQL. الذكاء الاصطناعي يفهم مساهمة المستخدم ويوازنها ويشرح أحداثًا موجودة، لكنه لا يختلق نتيجة المحاكاة.

This repository is a deployable vertical foundation for a deterministic living-world platform. Algorithms own world state; AI is constrained to structured interpretation and grounded narration.

## ما يعمل فعليًا | What is operational

- مولد كوكب إجرائي حتمي من Seed: ضوضاء كسرية ثلاثية الأبعاد، حرارة خط عرض، رطوبة، ظل مطر، صفائح، خصوبة، موارد، و12 إقليمًا حيويًا.
- محرك Tick حتمي مستقل مع Event Sourcing، causal links، snapshots كل 10 ticks، replay وrollback.
- نماذج مناخية شبكية، نمو لوجستي، predator/prey primitives، وDijkstra لمسارات آمنة.
- Monte Carlo لـ 64 مسارًا: الأجل القصير، ألف سنة، أفضل وأسوأ مسار، وعدم اليقين.
- PostgreSQL + PostGIS + pgvector، migrations، وبيانات seed حقيقية بالأعداد المطلوبة.
- تسجيل، دخول، access JWT، refresh-token rotation، كشف إعادة استخدام العائلة، RBAC، rate limits، CSP وvalidation.
- تدفق مساهمة كامل: تحليل منظم ← موازنة ← منطقة ← معاينة ← تأكيد ← حدث وتغير منطقة وإشعار في قاعدة البيانات.
- Provider adapters لـ OpenAI وAnthropic وGemini، مع Sandbox حتمي معلن عند غياب المفاتيح.
- كوكب React Three Fiber/WebGL2 يتغذى shader الخاص به من بيانات الارتفاع والرطوبة والحرارة والتلوث، مع سحب مرتبطة بالرطوبة، غلاف جوي، مدن وأحداث فعلية.
- WebSocket delta gateway فوق NATS، وعامل إشعارات للأحداث اللاحقة.
- واجهة عربية RTL وإنجليزية LTR، جودة رسومات تكيفية، ولوحة إدارة منفصلة محمية على مستوى API.
- OpenAPI عند `/docs`، health checks عند `/health`، وPrometheus metrics عند `/metrics`.

## حدود الإصدار الحالي | Explicitly unavailable

لا تدّعي الواجهة اكتمال ما لم يُربط. العناصر التالية موسومة «غير مفعّلة» أو غير معروضة:

- التسجيل الصوتي، OAuth لـ Google/Apple، وOTP.
- تشغيل التاريخ كفيديو ومقارنة بصرية كاملة بين حقبتين؛ API يقارن snapshots الموجودة فقط.
- خامات KTX2 وتفاصيل سطحية قريبة جدًا، حدود الحضارات المتحركة، ومسارات التجارة المرئية.
- واجهات الإدارة التفصيلية للمستخدمين والمراجعة وNATS traces وS3؛ مؤشرات الإدارة والتحكم في Tick والـrollback تعمل.
- Redis cache، رفع الملفات إلى MinIO، تصدير OpenTelemetry OTLP، وجدولة ticks موزعة. الخدمات موجودة في Compose لتوسعة المرحلة التالية لكنها لا تظهر كميزات مكتملة.

## التشغيل السريع | Quick start

المتطلبات: Docker 24+ وDocker Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

ثم افتح:

- المنصة: http://localhost:3000
- الإدارة: http://localhost:3001
- OpenAPI: http://localhost:4000/docs
- NATS monitoring: http://localhost:8222
- MinIO console: http://localhost:9001

تطبق خدمة API migrations وseed مرة واحدة تحت advisory lock.

### حساب Sandbox

يعمل فقط مع `SANDBOX_MODE=true` والبيانات المحلية:

```text
Email:    admin@planet.local
Password: Planet-Sandbox-2026!
Role:     super_admin
```

غيّر الأسرار وكلمة المرور، وعطّل Sandbox قبل أي نشر عام.

## التطوير المحلي | Local development

```bash
corepack enable
pnpm install
docker compose up -d postgres redis nats minio ai-orchestrator
pnpm db:migrate
pnpm dev
```

خدمات JavaScript تبدأ عبر `pnpm dev`. لتشغيل FastAPI خارج Docker:

```bash
cd services/ai-orchestrator
python -m venv .venv
. .venv/bin/activate
pip install -e '.[test]'
uvicorn app.main:app --reload --port 8000
```

الفحص:

```bash
pnpm check
pnpm test
pnpm build
pytest services/ai-orchestrator/tests
```

## بنية Monorepo

```text
apps/
  web/                    Next.js + React Three Fiber
  admin/                  protected operations console
services/
  api/                    Fastify API, auth, PostgreSQL, OpenAPI
  simulation-engine/      deterministic tick/event engine
  ai-orchestrator/        FastAPI provider adapters and balancing
  realtime-gateway/       NATS → WebSocket deltas
  world-generator/        seeded procedural planet generation
  notification-worker/    contribution-effect notifications
packages/
  ui/                     design tokens
  shared-types/           cross-service contracts
  simulation-models/      climate/ecology/path primitives
  validation/             Zod boundaries and injection rules
  config/                 environment contracts
  analytics/              privacy-conscious event contracts
```

## البيانات التجريبية

`002_seed.sql` ينشئ:

- كوكب أوريانا و288 منطقة مترابطة جغرافيًا.
- 12 حضارة، 40 مدينة، 120 موردًا.
- 300 نوع مخلوقات، 800 نبات، 50 تقنية.
- 12 ثقافة و12 لغة.
- 24 حدثًا تاريخيًا و23 رابطًا سببيًا.

لا تُستخدم هذه البيانات تلقائيًا في الإنتاج؛ شغّل migration seed فقط للـSandbox أو بيئة العرض.

## مبادئ المحاكاة

1. الحالة الأولية مشتقة من Seed.
2. كل Tick يستخدم RNG مشتقًا من `planetSeed:tick`.
3. كل تغير قابل للحفظ يمثّل `WorldEvent` بسبب واضح و`directEffects`.
4. reducer هو الذي يطبق الآثار ويمنع القيم غير المحدودة وتجاوز carrying capacity.
5. snapshots تُحفظ كل 10 ticks؛ replay يعيد checksum نفسه.
6. AI لا يستدعي `runTick` ولا يكتب حالة العالم.

تفاصيل الخوارزميات: [docs/simulation.md](docs/simulation.md)  
المعمارية والبيانات: [docs/architecture.md](docs/architecture.md)  
API وWebSocket: [docs/api.md](docs/api.md)  
النشر والأمن: [docs/deployment.md](docs/deployment.md)

## English summary

The same seed and ordered event stream reproduce the same state checksum. PostgreSQL is the source of truth; the browser never owns simulation logic. Contribution analysis is schema-validated and balanced before the simulation engine computes scenarios. If an AI provider is unavailable, the API returns a failure—unless the environment explicitly selects the labeled deterministic sandbox provider. It never reports a fabricated external-AI success.

This release establishes the final service boundaries and a real end-to-end contribution flow. The unavailable list above is intentional product truth, not placeholder success UI.
