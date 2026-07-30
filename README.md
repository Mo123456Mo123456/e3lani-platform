# كوكب يولد أمامك | A Planet Born Before You

**عالمك، قرارك، أثر لا ينتهي.**

منصة ويب حية تعرض كوكبًا ثلاثي الأبعاد يتطور باستمرار. يضيف كل مستخدم عنصرًا واحدًا؛ تحسب الخوارزميات الآثار السببية، ويصيغ الذكاء الاصطناعي الشرح دون اختلاق أحداث.

> English README: [README.en.md](./README.en.md)

## الحالة الحالية (مرحلة تشغيلية)

| المكوّن | الحالة |
|---|---|
| Monorepo (`apps/` · `services/` · `packages/`) | جاهز |
| محرك محاكاة حتمي + Event Sourcing | جاهز (`@planet/simulation-core`) |
| توليد كوكب إجرائي من Seed | جاهز |
| PostgreSQL + migrations + seed | جاهز |
| API (Fastify) + OpenAPI `/docs` + WebSocket `/ws` | جاهز |
| واجهة Next.js + React Three Fiber | جاهز |
| لوحة إدارة على منفذ منفصل | جاهز (`apps/admin` — لا تُعرض للمستخدم العادي) |
| AI Orchestrator متعدد المزودات + Sandbox | جاهز |
| Docker Compose | جاهز |
| اختبارات المحاكاة الحتمية | جاهز |

## التشغيل المحلي السريع

المتطلبات: Node 20+، pnpm 9، Python 3.12، PostgreSQL 16، Redis.

```bash
cp .env.example .env
pnpm install
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# تأكد أن PostgreSQL يعمل ثم:
pnpm db:migrate
pnpm db:seed
# طرفيات منفصلة:
pnpm dev:api          # :4000
pnpm dev:web          # :3000
pnpm dev:admin        # :3001
pnpm dev:ai           # :8002
pnpm dev:sim          # :8001
```

أو عبر Docker:

```bash
cp .env.example .env
docker compose up -d --build
```

## حسابات Sandbox

موثّقة هنا فقط — غيّرها قبل الإنتاج:

| الدور | البريد | كلمة المرور |
|---|---|---|
| Super Admin | `admin@planet-born.local` | `PlanetAdmin!2026` |
| مستكشف | `explorer@planet-born.local` | `Explorer!2026` |

عند غياب مفاتيح AI يعمل المزود `sandbox` بوضوح ولا يُعرض كذكاء اصطناعي سحابي حقيقي.

## التدفق الكامل المدعوم

1. إنشاء حساب / دخول  
2. فتح الكوكب وتدويره وتكبيره  
3. النقر على منطقة ومشاهدة بياناتها  
4. اختيار فئة وكتابة فكرة  
5. تحليل منظم + توازن + سرد مرتبط بالحقائق  
6. اختيار موقع وتأكيد الإضافة  
7. محاكاة فعلية تُكتب في PostgreSQL  
8. ظهور أحداث في السجل والخط الزمني  
9. إشعارات عند تطور الأثر  
10. إسقاطات مونت كارلو (احتمالية مع درجة عدم يقين)  
11. خريطة سببية عبر `/events/:id/causal`

## المعمارية

انظر [docs/architecture.md](./docs/architecture.md) و[docs/simulation-engine.md](./docs/simulation-engine.md) و[docs/ai-integration.md](./docs/ai-integration.md).

```
apps/web          Next.js + R3F (العربية RTL / الإنجليزية LTR)
apps/admin        لوحة إدارة منفصلة
services/api      Fastify + Drizzle + WS + RBAC
services/simulation-engine   FastAPI (خوارزميات رقمية)
services/ai-orchestrator     FastAPI (مزودات AI)
packages/simulation-core     محرك Ticks الحتمي
packages/shared-types        Zod types
packages/validation          مدخلات + مكافحة حقن
```

## الاختبارات

```bash
pnpm --filter @planet/simulation-core test
pnpm --filter @planet/api test   # عند توفرها
```

اختبارات إلزامية مغطاة في `packages/simulation-core/tests`: حتمية الـ Seed، Rollback، أسباب الأحداث، التوازن، القدرة الاستيعابية، السلسلة السببية.

## الأمان

- JWT + Refresh Token Rotation  
- RBAC للأدوار الإدارية  
- Rate limiting + Helmet  
- كشف Prompt Injection في طبقة التحقق  
- لا تُنفَّذ نصوص المستخدم كأوامر أو SQL  

## الترخيص

مشروع خاص — جميع الحقوق محفوظة لأصحاب المستودع ما لم يُنص على خلاف ذلك.
