# إعلاني | E3lani

**منصة الإعلانات المرئية لكل شيء** — Visual Advertising Platform for Everything.

منصة سعودية لإعلانات الصور والفيديو القصير مع تصفح عمودي. ليست متجرًا إلكترونيًا: لا سلة، لا توصيل، لا عمولة مبيعات، لا مزاد، لا محادثات، لا تعليقات.

> الوضع الحالي: **FREE_LAUNCH** — النشر مجاني ومباشر (مسودة → نشط) بعد فحص آلي فقط. نظام الدفع جاهز عبر Adapter لتفعيله لاحقًا بدون إعادة بناء.

## البنية (Turborepo Monorepo)

```text
e3lani-platform/
├── apps/
│   ├── mobile          # Expo + Expo Router
│   ├── web             # Next.js 15 — الموقع العام
│   └── admin           # Next.js 15 — لوحة الإدارة (RBAC)
├── services/
│   ├── api             # NestJS + Prisma + PostgreSQL
│   └── media-worker    # BullMQ + FFmpeg + sharp
├── packages/
│   ├── types · config · validation · auth · payments
│   ├── ui · api-client · i18n · storage
│   ├── database · eslint-config · tsconfig
├── infrastructure/docker
├── docs/
└── tests/
```

## التشغيل المحلي

```bash
pnpm install
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example .env
cp services/api/.env.example services/api/.env

pnpm --filter @e3lani/api prisma:generate
pnpm --filter @e3lani/api exec prisma migrate deploy
pnpm db:seed

pnpm --filter @e3lani/api build && pnpm --filter @e3lani/api start
# اختياري:
pnpm --filter @e3lani/media-worker build && pnpm --filter @e3lani/media-worker start
pnpm --filter @e3lani/web dev
pnpm --filter @e3lani/admin dev
pnpm --filter @e3lani/mobile start
```

| الخدمة | العنوان |
|---|---|
| API | http://localhost:3001/api/v1 |
| Docs | http://localhost:3001/api/docs |
| Web | http://localhost:3000 |
| Admin | http://localhost:3002 |

## حساب إدارة تجريبي (Sandbox فقط)

| الحقل | القيمة |
|---|---|
| الجوال | `+966500000001` |
| OTP (Sandbox) | `123456` — يظهر في **سجلات الخادم فقط**، وليس في واجهة المستخدم |
| الدور | `SUPER_ADMIN` |
| البريد | `admin@e3lani.local` |

> لا يوجد تسجيل دخول تجريبي ظاهر للمستخدم النهائي. رمز OTP التجريبي لا يُعاد في استجابة الـ API ولا يُعرض في الشاشات.

## التسعير (قابل للتعديل من لوحة الإدارة فقط)

| الخدمة | السعر |
|---|---:|
| إعلان عادي 30 يومًا | 59 ر.س |
| إعادة نشر | 5 ر.س |
| تمديد 15 يومًا | 5 ر.س |
| إبراز 3 أيام | 10 ر.س |
| إبراز 7 أيام | 20 ر.س |
| أعلى القسم | 15 ر.س |
| مدينة إضافية | 5 ر.س |
| شعار الشريط العلوي | 50 ر.س |

النشر مجاني حاليًا. الأسعار محفوظة في `PricingVersion` وتُعدَّل من `/admin/pricing`.

## قواعد المنتج الملزمة

- FREE_LAUNCH: مسودة → نشط (بدون مراجعة بشرية)
- عند تفعيل الدفع: مسودة → بانتظار الدفع → نشط
- المراجعة البشرية بعد البلاغ فقط
- المنشورات المجانية منفصلة عن الإعلانات ولا تظهر في الموجز
- الشريط العلوي: حركة مستمرة، غير قابل للنقر، لا يتوقف عند اللمس
- لا نجاح دفع وهمي في الإنتاج

## الوثائق

- [`docs/DELIVERY_SUMMARY_AR.md`](docs/DELIVERY_SUMMARY_AR.md) — ملخص الوظائف المكتملة
- [`docs/KEYS_AND_ACCOUNTS_AR.md`](docs/KEYS_AND_ACCOUNTS_AR.md) — المفاتيح والخدمات الخارجية
- [`docs/OPERATIONS_AR.md`](docs/OPERATIONS_AR.md) — أوامر التشغيل وربط الخدمات
- [`.env.example`](.env.example) — متغيرات البيئة

## الجودة

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration
```
