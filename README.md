# كوكب يولد أمامك

**عالمك، قرارك، أثر لا ينتهي.**

هذا المستودع هو أساس monorepo لمنصة محاكاة كوكبية تضع الخوارزميات أولاً: توليد إجرائي للعالم، محرك محاكاة حتمي، مساهمات المستخدمين، طبقة AI للمساعدة لا للاستبدال، وتطبيق ويب عربي RTL افتراضياً.

> الحالة الحالية: الأساس يعمل محلياً. بعض مسارات الإنتاج موسومة بوضوح بـ **غير مفعّل** مثل حارس الإدارة الكامل، الرسوم المالية للـ AI، والجدولة التلقائية داخل API.

## البنية

```txt
apps/web                  واجهة عامة Next.js 15 + React Three Fiber
apps/admin                لوحة إدارة منفصلة غير مرتبطة من الواجهة العامة
services/api              Fastify REST + Swagger + JWT + Drizzle schema + SQLite dev
services/simulation-engine محرك حتمي event-sourced مع CLI واختبارات
services/world-generator  توليد كوكب من seed: خرائط ارتفاع/رطوبة/حرارة/أقاليم/أنهار
services/ai-orchestrator  واجهات OpenAI/Anthropic/Gemini/Mock؛ Mock يعمل بلا مفاتيح
services/realtime-gateway WebSocket delta topics
services/notification-worker طابور محلي بسيط للإشعارات
packages/shared-types     Zod schemas وأنواع TypeScript مشتركة
packages/simulation-models خوارزميات deterministic RNG/noise/biomes/population/war/pathfinding/causal graph
packages/validation       قواعد توازن مساهمات المستخدمين
packages/config           env/ports/feature flags
packages/ui               design tokens وثيم زجاجي داكن
packages/analytics        واجهة analytics داخلية بسيطة
```

## التشغيل السريع

```bash
corepack enable
pnpm install
pnpm test
pnpm --filter @kawkab/api db:migrate
pnpm --filter @kawkab/api db:seed
pnpm --filter @kawkab/api dev
pnpm --filter @kawkab/realtime-gateway dev
pnpm --filter @kawkab/web dev
pnpm --filter @kawkab/admin dev
```

- الويب: <http://localhost:3000>
- الإدارة: <http://localhost:3001>
- API: <http://localhost:4000>
- Swagger: <http://localhost:4000/docs>
- WebSocket: `ws://localhost:4010`

## حساب الإدارة التجريبي

شغّل:

```bash
pnpm --filter @kawkab/api db:seed
```

ثم استخدم القيم الافتراضية أو غيّرها في `.env`:

- البريد: `admin@kawkab.local`
- كلمة المرور: `change-me-admin`

## أوامر مهمة

```bash
pnpm dev          # تشغيل كل dev tasks عبر Turbo
pnpm build        # بناء كل الحزم والتطبيقات
pnpm test         # Vitest
pnpm lint         # فحص TypeScript
pnpm db:migrate   # إنشاء جداول SQLite المحلية
pnpm db:seed      # إنشاء super admin تجريبي
pnpm docker:up    # Postgres/Redis/MinIO/API/Simulation/Web
pnpm --filter @kawkab/simulation-engine simulate
```

## مبادئ التصميم

- الـ AI ليس المحاكاة؛ المحاكاة حتمية وخوارزمية أولاً.
- نفس `seed` ونفس سجل الأحداث ينتجان نفس الحالة.
- كل حدث عالمي يجب أن يحمل سبباً (`causeEventIds`).
- المنطق المحاكي داخل الخدمات والحزم، وليس في الواجهة.
- الواجهة تستخدم ألوان: navy الخلفية، cyan للتقنية، green للنباتات، gold للحضارات، purple للهجرات، red للحروب، orange للبراكين.

## Docker

```bash
cp .env.example .env
pnpm install
pnpm docker:up
```

PostgreSQL مهيأ في compose، بينما يستخدم API SQLite محلياً إذا لم تضبط `DATABASE_URL`.
