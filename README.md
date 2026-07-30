
# كوكب يولد أمامك

**عالمك، قرارك، أثر لا ينتهي.**

Monorepo لمنصة محاكاة كوكبية تعتمد على الخوارزميات أولاً: توليد عالم حتمي، محرك محاكاة event-sourced، مساهمات مستخدمين تمر عبر موازنة ومعاينة، ثم تطبيق حي يكتب الأحداث والإشعارات والزمن في قاعدة البيانات.

## ما يعمل الآن

- عالم demo غني بالبذرة `kawkab-rich-demo`:
  - 12 حضارة، 40 مدينة، 120+ مورد، 300+ نوع، 800+ نبات، 50+ تقنية.
  - seed الحالي في الاختبار المحلي أنشأ: 12 حضارة، 40 مدينة، 467 مورد، 311 نوع، 1000 نبات، 64 تقنية، 223 حدث.
- API يحمل حالة الكوكب من SQLite عند البدء أو ينشئها إن لم توجد.
- مساهمة كاملة:
  1. تسجيل / دخول JWT.
  2. `POST /contributions` يحلل الفكرة عبر Mock AI ويوازنها.
  3. `GET /contributions/:id/preview` يطبقها على fork، يشغل ticks قصيرة + Monte Carlo، ويرجع deltas/risks/successProbability/suitableBiomes.
  4. `POST /contributions/:id/confirm` يطبقها على العالم الحي، يحفظ `world_events` و snapshot/state، ينشئ notifications، ويبث realtime.
- endpoints إضافية: causal graph، compare، timeline، notifications، scenarios.
- Realtime gateway يقبل `POST /broadcast` ويبث إلى WebSocket.
- Web app: RTL افتراضي، login/register، wizard كامل، timeline scrub، causal graph SVG، compare/futures panels، city lights/event markers/layers على الكوكب.
- Admin app: login حقيقي، users، contributions moderation، tick/pause/resume.

## غير مفعّل / حدود صادقة

- تكاليف AI ورسوم billing: **غير مفعّل** حتى ربط مزودي الإنتاج.
- مزودو OpenAI/Anthropic/Gemini معرفون كواجهات؛ Mock يعمل دائماً دون مفاتيح.
- Redis queue production worker غير مربوط بعد؛ API ينشئ notifications مباشرة حالياً.
- Docker Compose يجهز PostgreSQL، لكن مسار التطوير الحالي يستخدم SQLite إذا لم تضبط تكامل Postgres كامل.

## التشغيل السريع

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm --filter @kawkab/api db:migrate
pnpm --filter @kawkab/api db:seed
pnpm --filter @kawkab/realtime-gateway dev
pnpm --filter @kawkab/api dev
pnpm --filter @kawkab/web dev
pnpm --filter @kawkab/admin dev
```

- Web: <http://localhost:3000>
- Admin: <http://localhost:3001>
- API: <http://localhost:4000>
- Swagger: <http://localhost:4000/docs>
- WebSocket/HTTP broadcast: `ws://localhost:4010` و `POST http://localhost:4010/broadcast`

## حساب الإدارة التجريبي

بعد `pnpm --filter @kawkab/api db:seed`:

- البريد: `admin@kawkab.local`
- كلمة المرور: `change-me-admin`

للمستخدم العادي يمكن التسجيل من الواجهة أو `POST /auth/register`.

## أوامر مهمة

```bash
pnpm dev
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm db:migrate
pnpm db:seed
pnpm docker:up
pnpm --filter @kawkab/simulation-engine simulate
```

## مسار المساهمة عبر API

```bash
# 1) register/login -> accessToken
# 2) create
POST /contributions
# 3) preview
GET /contributions/:id/preview
# 4) confirm
POST /contributions/:id/confirm
# 5) read resulting notifications/events/timeline
GET /notifications
GET /planets/:id/events
GET /planets/:id/timeline
GET /planets/:id/causal-graph
```

## مبادئ المحاكاة

- الـ AI لا يقرر العالم؛ المحرك الخوارزمي يقرر.
- نفس seed ونفس events يعيدان نفس الحالة.
- كل حدث له `causeEventIds`.
- frontend يعرض ويطلب فقط؛ منطق المحاكاة في services/packages.
