# كوكب يولد أمامك · A Planet Born Before You

**عالمك، قرارك، أثر لا ينتهي.**  
**Your world, your decision, an impact without end.**

منصة ويب لمحاكاة عالم إجرائي حي. يولّد المحرك الكوكب من Seed ثابت، ويحوّل
المساهمات إلى أحداث سببية قابلة لإعادة التشغيل، بينما يقتصر دور نموذج اللغة
على الفهم والشرح ولا يملك سلطة الأرقام أو حالة العالم.

## ما يعمل الآن

| المجال | الحالة |
|---|---|
| توليد الكوكب | حتمي من Seed؛ ارتفاع وحرارة ورطوبة وموارد ومناطق حيوية على شبكة كروية |
| المحاكاة | Ticks، PRNG حتمي، Event Sourcing، Replay، Snapshots، وروابط سببية |
| الأنظمة | نمو محدود بالقدرة الاستيعابية، تلوث، هجرات، أمراض، براكين، موارد، حضارات وتقنيات أولية |
| المستقبل | Monte Carlo حتمي يعرض likely / best / worst وعدم اليقين |
| API | Fastify + OpenAPI + WebSocket deltas + PostgreSQL/Drizzle + RBAC |
| الذكاء الاصطناعي | Adapters لـ OpenAI وAnthropic وGemini وMock Sandbox مع Structured Output |
| الواجهة | Next.js، العربية RTL والإنجليزية LTR، وكوكب WebGL حقيقي عبر R3F/Three.js |
| المساهمة | حساب → فكرة → تحليل خادمي → مخاطر وآثار → منطقة → Preview → Commit → حدث وSnapshot |
| الإدارة | تطبيق مستقل محمي لإيقاف Ticks واستئنافها والرجوع إلى Snapshot |
| التشغيل | Docker Compose، PostgreSQL مع PostGIS/pgvector، NATS، Redis، MinIO، وCI |

الاقتصاد الكامل، الوكلاء الحضاريون العميقون، Web Workers/LOD المتقدم، الصوت،
الإشعارات الخارجية، OpenTelemetry ولوحات التكلفة ما زالت **غير مفعلة**. توجد
نقاط توسعة ومخططات بيانات لها، ولا تعرضها الواجهة كميزات مكتملة.

## التشغيل السريع

يتطلب Node.js 22+ وpnpm 9+:

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm dev
```

- الويب: <http://localhost:3000>
- API وOpenAPI: <http://localhost:3001/docs>
- الإدارة: <http://localhost:3002>

للتشغيل المتكامل بقاعدة PostgreSQL وNATS:

```bash
cp .env.example .env
# ضع قيماً قوية للحقول الإلزامية في .env
docker compose up --build
```

### حساب Super Admin في Sandbox

هذه البيانات للاختبار المحلي فقط. انسخها إلى متغيري
`SANDBOX_SUPER_ADMIN_EMAIL` و`SANDBOX_SUPER_ADMIN_PASSWORD` داخل `.env` قبل
تشغيل seed:

```text
Email: superadmin@kawkab.local
Password: Kawkab-Sandbox-2026!Safe
```

ينشأ الحساب بدور `super_admin` فقط عندما تكون `SANDBOX_MODE=true`. لا توجد
بيانات دخول افتراضية في وضع الإنتاج.

## أوامر التطوير

```bash
pnpm dev                 # web + API + admin
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
pnpm db:seed
```

يمكن تشغيل وضع متصفح محلي بلا خادم عبر
`NEXT_PUBLIC_SANDBOX_MODE=true`. يظهر هذا الوضع بوضوح باسم Sandbox، ولا يُستخدم
تلقائيًا عند فشل API. لا يسمح الخادم بمزود Mock عندما يكون
`SANDBOX_MODE=false`.

## البنية

```text
apps/
  web/                    Next.js + React Three Fiber
  admin/                  protected operations console
services/
  api/                    Fastify, WebSocket, auth, PostgreSQL adapters
packages/
  shared-types/           strict Zod contracts
  simulation-models/      deterministic generator, ticks, replay, scenarios
infra/postgres/           PostgreSQL image with PostGIS + pgvector
```

ملفات تطبيق `E3lani` السابقة ما زالت محفوظة في الجذر للتاريخ فقط، لكنها ليست
ضمن `pnpm-workspace.yaml` ولا تدخل في بناء منصة كوكب.

## مبادئ الثقة

1. يحسب `simulation-models` والطبقة الخوارزمية الآثار الرقمية.
2. مخرجات مزود AI استشارية ومنظمة؛ الاختبارات تثبت أن دلتا متطرفة من المزود
   لا تغيّر نتيجة المحرك.
3. كل Commit يكتب Tick وWorldEvent وCausalLink وSnapshot وإشعارًا داخل معاملة.
4. يعاد طلب Commit بنفس idempotency key دون تكرار الأثر.
5. أي Sandbox أو Adapter غير مضبوط يعلن حالته ولا يقلّد نجاح الإنتاج.

## English

This monorepo implements a runnable simulation-first vertical slice: a
deterministic procedural world, replayable causal events, bounded contribution
effects, probabilistic future scenarios, PostgreSQL persistence, secure
cookie-based authentication, real-time deltas, an interactive WebGL globe, and
a separate protected admin console.

AI providers classify and explain. They do not author authoritative numeric
effects. Production mode fails closed when persistence or provider credentials
are missing; synthetic data is available only through an explicit sandbox flag.

See [architecture](./docs/architecture.md),
[simulation design](./docs/simulation-engine.md), and
[API/realtime contracts](./docs/api-and-realtime.md).
