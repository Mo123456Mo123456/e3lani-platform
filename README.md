# كوكب يولد أمامك — Planet Born Before You

**عالمك، قرارك، أثر لا ينتهي.**

منصة ويب حيّة تعرض كوكبًا ثلاثي الأبعاد يتطور باستمرار. يضيف المستخدم عنصرًا واحدًا؛ يحلّله النظام، يوازنه، ثم يشغّل محرك محاكاة سببي حتمي، ويستخدم الذكاء الاصطناعي فقط للشرح والصياغة — لا لاختلاق النتائج.

> English summary follows the Arabic section.

---

## الحالة الحالية (مرحلة الأساس + مسار القبول)

| المكوّن | الحالة |
|---|---|
| Monorepo (`apps` / `services` / `packages`) | ✅ |
| PostgreSQL + migrations + seed | ✅ |
| محرك تicks حتمي + Event-ish history + snapshots | ✅ |
| توليد كوكب إجرائي من Seed | ✅ |
| واجهة Next.js + React Three Fiber | ✅ |
| WebSocket (Socket.IO على API) | ✅ |
| AI Orchestrator + Sandbox/OpenAI adapters | ✅ |
| لوحة إدارة منفصلة (`apps/admin`) | ✅ |
| Docker Compose + CI | ✅ |
| PostGIS / pgvector / NATS كامل | ⏳ مهيأ للتوسعة — غير مفعّل كميزة مكتملة |
| تقسيم realtime-gateway / notification-worker | ⏳ مضمّن في API حاليًا (موثّق) |

---

## التشغيل السريع

### المتطلبات

- Node.js 20+
- pnpm 9.12
- PostgreSQL 16 و Redis (أو Docker Compose)

### إعداد محلي بدون Docker لقاعدة البيانات

```bash
cp .env.example .env
pnpm install
pnpm --filter @planet/shared-types build
pnpm --filter @planet/config build
pnpm --filter @planet/validation build
pnpm --filter @planet/simulation-models build
pnpm db:migrate
pnpm db:seed
```

ثم في طرفيات منفصلة:

```bash
pnpm --filter @planet/ai-orchestrator dev   # :5001
pnpm --filter @planet/simulation-engine dev # :4001
pnpm --filter @planet/api dev               # :4000
pnpm --filter @planet/web dev               # :3000
pnpm --filter @planet/admin dev             # :3001
```

أو: `pnpm dev` لتشغيل api + web + ai + simulation معًا.

- الواجهة: http://localhost:3000  
- الإدارة: http://localhost:3001 (لا تُعرض للمستخدم العادي)  
- OpenAPI: http://localhost:4000/docs  

### حسابات Sandbox (للتطوير فقط)

| الدور | البريد | كلمة المرور |
|---|---|---|
| Super Admin | `admin@planet-born.local` | `PlanetAdmin!2026` |
| Explorer | `explorer@planet-born.local` | `Explorer!2026` |

غيّر كلمات المرور قبل أي نشر.

### الذكاء الاصطناعي

بدون مفاتيح خارجية يعمل **Sandbox Provider** ويُعلَّم في الواجهة والاستجابات بـ `sandbox: true`.  
المزوّدون: `sandbox` | `openai` | `anthropic` | `gemini` عبر `AI_PROVIDER`.

---

## مسار القبول للمستخدم

1. إنشاء حساب / دخول  
2. تدوير وتكبير الكوكب  
3. فتح منطقة ومشاهدة بياناتها  
4. اختيار فئة وكتابة فكرة  
5. تحليل AI (Sandbox أو مزود حقيقي)  
6. معاينة الخصائص والمخاطر والمنطقة  
7. تأكيد الإضافة → محاكاة حقيقية في PostgreSQL  
8. ظهور أحداث في السجل والخط الزمني  
9. مقارنة قبل/بعد + سيناريوهات احتمالية  
10. خريطة سببية عبر `/v1/planet/causal`  

---

## البنية

انظر [docs/architecture.md](docs/architecture.md) و [docs/simulation-engine.md](docs/simulation-engine.md) و [docs/ai-integration.md](docs/ai-integration.md) و [docs/database.md](docs/database.md).

```
apps/web          واجهة الكوكب
apps/admin        لوحة الإدارة
services/api      REST + WS + Auth
services/simulation-engine
services/ai-orchestrator
packages/simulation-models
packages/shared-types
packages/validation
packages/config
packages/ui
```

---

## الاختبارات

```bash
pnpm --filter @planet/simulation-models test
pnpm --filter @planet/ai-orchestrator test
```

اختبارات حتمية أساسية: نفس الـ Seed ⇒ نفس العالم؛ إعادة الـ ticks ⇒ نفس الهاش؛ لا حرب بلا سبب؛ توازن العناصر الخارقة؛ المسارات لا تعبر المحيطات.

---

## English

**Planet Born Before You** is a living 3D planet platform. Users add one element; a deterministic causal simulation computes effects; AI only structures input and narrates real events.

### Quick start

```bash
cp .env.example .env && pnpm install
pnpm --filter @planet/shared-types build && pnpm --filter @planet/config build
pnpm --filter @planet/validation build && pnpm --filter @planet/simulation-models build
pnpm db:migrate && pnpm db:seed && pnpm dev
```

Sandbox accounts are listed above. Admin UI is separate on `:3001` and is not linked from the public app.
