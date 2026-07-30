# كوكب يولد أمامك | A Planet Born Before You

**عالمك، قرارك، أثر لا ينتهي.**  
**Your world. Your choice. An endless impact.**

منصة عالم ثلاثي الأبعاد حتمي يتطور عبر محرك محاكاة سببي، وليس عبر نص يختلقه نموذج لغوي. يضيف المستخدم عنصرًا، فيُحوّل إلى خصائص منظمة، يُراجع ويُوازن، تُشغّل له مسارات Monte Carlo، ثم تُحفظ آثاره كأحداث قابلة للتتبع في PostgreSQL وتصل إلى الواجهة كتحديثات Delta فورية.

A deterministic 3D world platform driven by a causal simulation engine rather than LLM-authored outcomes. A user's element is structured, moderated, balanced, simulated across Monte Carlo paths, persisted as traceable PostgreSQL events, and broadcast to the globe as realtime delta updates.

## الحالة الحالية | Current status

هذه النسخة تؤسس المعمارية النهائية وتنفذ مسارًا رأسيًا حقيقيًا:

1. تسجيل مستخدم ببريد وكلمة مرور مشتقة بـ `scrypt`.
2. استعادة عالم إجرائي من Seed ثابت وSnapshot مخزن.
3. عرض كوكب WebGL تفاعلي مشتق من بيانات المناطق، بلا صورة سطح ثابتة.
4. تحديد منطقة ومشاهدة مناخها ومياهها وخصوبتها وسكانها.
5. تحليل مساهمة إلى Structured Output مع كشف Prompt Injection.
6. موازنة الصفات الخارقة وإظهار المخاطر.
7. تشغيل 64 مسارًا حتميًا لآفاق 1 و10 و100 و1000 سنة.
8. تأكيد المساهمة، حفظها، تشغيل Tick، وإنتاج أحداث ذات أسباب وصيغ معلنة.
9. بث التغيرات عبر Socket.IO دون إعادة تحميل الحالة كاملة.
10. ظهور الحدث على الكوكب وفي السجل والخط الزمني.

المرحلة الحالية ليست ادعاءً باكتمال كل الأنظمة المذكورة في خارطة المنتج. الاقتصاد والحروب والهجرات المتقدمة وRollback الإداري والمؤثرات الجوية الكاملة ظاهرة كغير مفعّلة حيث تظهر، ولم تُعرض كقدرات مكتملة.

This revision implements the production-shaped architecture and one real end-to-end vertical slice. Advanced economy, warfare, migration, admin rollback, and full atmospheric effects remain later phases and are explicitly disabled rather than presented as complete.

> توجد ملفات تطبيق Expo السابق في جذر المستودع لأغراض تاريخية فقط. لا تدخل في `pnpm-workspace.yaml` ولا في أي أمر بناء للمنتج الجديد. المنتج الجديد موجود حصريًا في `apps/`, `services/`, و`packages/`.

## المعمارية | Architecture

```text
apps/
  web/                    Next.js + React Three Fiber world dashboard
  admin/                  separate RBAC-protected operations dashboard
services/
  api/                    NestJS REST, Swagger, auth, PostgreSQL, Socket.IO
  ai-orchestrator/        FastAPI provider adapters and grounded narration
packages/
  shared-types/           cross-service contracts
  simulation-models/      PRNG, world generator, ticks, event replay, Monte Carlo
```

التفاصيل والمخططات: [docs/architecture.md](docs/architecture.md)  
محرك المحاكاة: [docs/simulation-engine.md](docs/simulation-engine.md)  
واجهات HTTP وWebSocket: [docs/api-and-realtime.md](docs/api-and-realtime.md)

## التشغيل المحلي الكامل | Full local run

المتطلبات: Node.js 22+، pnpm 9، Docker مع Compose.

```bash
cp .env.example .env
# غيّر JWT_SECRET قبل أي بيئة مشتركة
pnpm install
docker compose up -d postgres redis nats ai-orchestrator
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- واجهة العالم: `http://localhost:3000`
- لوحة الإدارة: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`
- AI orchestrator: `http://localhost:8000/docs`

تشغّل `pnpm dev` التطبيقات المسجلة في Turborepo. يمكن تشغيل مكوّن منفرد:

```bash
pnpm dev:web
pnpm dev:api
pnpm --filter @planet/admin dev
```

## حساب Sandbox

يُنشئ `pnpm db:seed` الحساب التالي فقط في بيئة Sandbox:

```text
Email:    superadmin@planet.sandbox
Password: PlanetSandbox!2026
Role:     super_admin
```

لا تستخدم هذه البيانات في staging أو production. غيّرها أو احذف الحساب مباشرة بعد التحقق.

## مزودو الذكاء الاصطناعي | AI providers

`services/ai-orchestrator` يدعم:

- `AI_PROVIDER=openai`
- `AI_PROVIDER=anthropic`
- `AI_PROVIDER=gemini`
- `AI_PROVIDER=mock` للاختبار المعلن فقط، ويُمنع في `NODE_ENV=production`.

عند غياب مزود صالح، يفشل التحليل برسالة واضحة ولا تُعرض نتيجة مصطنعة على أنها AI حقيقي. المحاكاة الرقمية دائمًا في `@planet/simulation-models`; دور النموذج هو الاستخراج المنظم والسرد المقيد بالأحداث.

## قاعدة البيانات | Database

الهجرة `services/api/migrations/001_foundation.sql` تفعل PostGIS وpgvector وتعرّف:

`users`, `profiles`, `roles`, `planets`, `planet_regions`, `biomes`, `climate_cells`, `species`, `plants`, `resources`, `civilizations`, `cities`, `technologies`, `cultures`, `languages`, `trade_routes`, `alliances`, `wars`, `diseases`, `migrations`, `user_contributions`, `simulation_ticks`, `world_events`, `causal_links`, `timeline_snapshots`, `ai_requests`, `moderation_results`, `notifications`, `audit_logs`, و`world_memory`.

لا يملك API fallback إنتاجيًا إلى ذاكرة مؤقتة؛ غياب `DATABASE_URL` أو migration يوقفه برسالة صريحة.

## الجودة | Quality gates

```bash
pnpm check    # strict TypeScript across all workspaces
pnpm test     # deterministic, replay, moderation, Monte Carlo, capacity tests
pnpm build    # production builds for web, admin, API, and packages
python3 -m py_compile services/ai-orchestrator/app/main.py
docker compose config --quiet
```

الاختبارات الحالية تثبت أن Seed نفسه يعيد العالم والتاريخ نفسيهما، وأن إعادة الأحداث تعيد Checksum نفسه، وأن كل حدث مولّد يملك سببًا، وأن السكان لا يتجاوزون القدرة الاستيعابية، وأن Prompt Injection يُرفض، وأن نتائج Monte Carlo قابلة للإعادة. اختبارات تكامل PostgreSQL وE2E المتصفح التالية مطلوبة في CI المجهز بـ Docker.

## النشر | Deployment

1. استخدم PostgreSQL 17 مع PostGIS وpgvector وخدمة Redis/NATS مُدارة.
2. ضع الأسرار في secret manager، ولا تنسخ `.env` إلى الصورة.
3. نفّذ migration كـ release job واحد قبل رفع API.
4. شغّل API بعد نجاح `/api/v1/system/health`.
5. انشر `apps/web` و`apps/admin` كنطاقين منفصلين؛ لا تربط لوحة الإدارة من الموقع العام.
6. امنع `AI_PROVIDER=mock` في الإنتاج واضبط allowlist دقيقًا لـ `WEB_ORIGIN`.
7. احتفظ بنسخ PostgreSQL وSnapshots واختبر الاستعادة دوريًا.
