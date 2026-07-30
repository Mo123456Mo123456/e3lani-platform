# كوكب يولد أمامك

**عالمك، قرارك، أثر لا ينتهي.**

منصة عالم حي حتمية: يولّد الخادم كوكبًا إجرائيًا من Seed ثابت، ويحفظ كل
تغيير كحدث سببي في PostgreSQL، بينما تعرض واجهة WebGL البيانات الفعلية
للتضاريس والمناخ والمناطق الحيوية. الذكاء الاصطناعي يحوّل فكرة المستخدم إلى
بيانات منظّمة فقط؛ المحرك الخوارزمي هو الذي يحسب الأثر.

> هذه هي الشريحة التشغيلية الأولى وليست ادعاءً باكتمال جميع المراحل. التدفق
> الكامل من إنشاء الحساب حتى إضافة عنصر وتشغيل Tick وظهور الحدث بصريًا يعمل.
> الحروب والتجارة والهجرات والأمراض لها نماذج وعقود أحداث، لكن خوارزمياتها
> المتقدمة وطبقاتها المرئية موسومة «قيد التطوير».

## ما يعمل الآن

- Next.js وReact Three Fiber وGLSL: كوكب تفاعلي من Data Texture مولّدة من
  حالة العالم، مع تضاريس، محيط، غلاف جوي، سحب، أحداث، Zoom وOrbit.
- مولّد حتمي يجمع Fractal Noise وWorley ridges والرطوبة وظل المطر والارتفاع.
- 1,152 منطقة، 12 حضارة و300 نوع؛ Seed اختياري يضيف 40 مدينة و120 موردًا
  و800 نبات و50 تقنية.
- محرك Ticks مستقل، Event Sourcing، causal links، snapshots وإعادة تشغيل.
- محاكاة Monte Carlo حتمية لـ1 و10 و100 و1,000 سنة مع عدم يقين.
- PostgreSQL + PostGIS + pgvector، وNATS JetStream، وWebSocket Delta Updates.
- تسجيل حقيقي بكلمات مرور مجزّأة، JWT قصير، Refresh Token rotation وRBAC.
- Adapters لـOpenAI وAnthropic وGemini ونموذج محلي وSandbox معلن.
- واجهة عربية RTL وإنجليزية LTR، جودة Ultra/High/Medium/Eco.
- لوحة إدارة مستقلة عند المنفذ `3001` لا يظهر رابطها للمستخدم.
- OpenAPI تفاعلي عند `/docs` واختبارات الحتمية وإعادة التشغيل والأمان البنيوي.

## التشغيل

يتطلب Node.js 22 وpnpm وDocker:

```bash
cp .env.example .env
pnpm install
docker compose up -d --build --wait postgres redis nats minio
pnpm db:seed
pnpm dev
```

- المنصة: <http://localhost:3000>
- API: <http://localhost:4000>
- OpenAPI: <http://localhost:4000/docs>
- الإدارة: `pnpm --filter @planet/admin dev` ثم <http://localhost:3001>

تشغيل الحاويات كاملة:

```bash
docker compose up --build
docker compose --profile admin up --build
```

لبذر بيانات Sandbox داخل بيئة الحاويات:

```bash
docker compose run --rm -e NODE_ENV=development api node dist/seed.js
```

### حساب Sandbox الإداري

يعمل بعد `pnpm db:seed` فقط:

```text
Email: admin@planet.local
Password: PlanetSandbox!2026
```

غيّر `SANDBOX_ADMIN_PASSWORD` محليًا عند الحاجة. أمر البذر يرفض العمل في
`NODE_ENV=production`.

## مزود الذكاء الاصطناعي

الوضع الافتراضي `AI_PROVIDER=sandbox` ويظهر في الواجهة بوضوح
`Sandbox: قواعد حتمية`؛ لا يُقدَّم على أنه نموذج ذكاء اصطناعي. للإنتاج اختر
`openai` أو `anthropic` أو `gemini` أو `local` واضبط المفتاح. يرفض الخادم
تشغيل Sandbox في الإنتاج ما لم تضبط `ALLOW_SANDBOX_AI=true` صراحة.

## أوامر الجودة

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

## البنية

```text
apps/
  web/                  # لوحة العالم وWebGL
  admin/                # إدارة RBAC مستقلة
services/
  api/                  # REST/OpenAPI/PostgreSQL/WebSocket/NATS
  ai-orchestrator/      # Structured output + provider adapters
packages/
  shared-types/         # Zod contracts
  simulation-models/    # world generation, ticks, replay, forecasts
```

توجد مصادر المنتج السابق تاريخيًا خارج مسارات الـworkspace الجديدة؛ لا تدخل
في البناء أو التشغيل أو الاختبارات.

التوثيق:

- [المعمارية وقاعدة البيانات والأمان](docs/planet-architecture.md)
- [محرك التوليد والمحاكاة والحدود العلمية](docs/simulation-engine.md)
- [REST وWebSocket وNATS](docs/api-and-realtime.md)

---

## English

**A Planet Born Before You — Your world. Your decision. An endless impact.**

This repository now contains a runnable first vertical slice of a deterministic
living-world platform. PostgreSQL is the source of truth; the planet shader
renders generated world data rather than a static image; all accepted changes
append causal events and snapshots. AI providers only produce schema-validated
contribution properties. The simulation engine computes outcomes.

Run the stack with the commands above. The implemented scope includes account
creation, an interactive planet, region inspection, structured contribution
analysis, probabilistic preview, placement, deterministic ticks, persisted
events, live deltas, timeline history, and a protected admin status page.
Advanced war, trade, migration, disease, and full moderation workers remain
explicitly inactive, as documented in the simulation guide.
