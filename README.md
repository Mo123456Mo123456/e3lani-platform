# إعلاني | E3lani

**منصة الإعلانات المرئية لكل شيء**

منصة سعودية للإعلانات المرئية، وليست متجرًا إلكترونيًا. لا يوجد بيع مباشر أو سلة أو توصيل
أو محادثات أو تعليقات. ينقل زر التواصل المستخدم مباشرة إلى واتساب أو الاتصال أو متجر المعلن
أو الرابط المعتمد.

## البنية

المشروع Monorepo مبني بـ Turborepo وTypeScript:

```text
apps/
  mobile/          Expo + React Native + Expo Router
  web/             Next.js 15 App Router للموقع العام
  admin/           Next.js 15 App Router للوحة الإدارة
services/
  api/             NestJS + JWT/OTP + RBAC + REST
  media-worker/    BullMQ + FFmpeg + sharp
packages/
  database/        PostgreSQL + Prisma + seed
  types/           Zod وعقود TypeScript
  ui/              Tailwind ومكونات RTL
  config/
  eslint-config/
  tsconfig/
```

الكود القديم المستورد قبل الترحيل ما زال في مسارات الجذر كمرجع فقط؛ أوامر Turborepo تبني
المسارات أعلاه حصريًا، ولا يستخدم تشغيل الإصدار الجديد `AsyncStorage` كمصدر لحقيقة المنتج.

## التشغيل المحلي

المتطلبات: Node.js 20.19+، pnpm 9، Docker، وأداة `zip` لإنشاء حزمة التسليم.

```bash
cp .env.example .env
pnpm install
pnpm dev:infra
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

الخدمات الافتراضية:

- الموقع العام: `http://localhost:3000`
- لوحة الإدارة: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- MinIO Console: `http://localhost:9001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

يمكن تشغيل تطبيق بعينه:

```bash
pnpm --filter @e3lani/mobile dev
pnpm --filter @e3lani/web dev
pnpm --filter @e3lani/admin dev
pnpm --filter @e3lani/api dev
pnpm --filter @e3lani/media-worker dev
```

## سلوك الإطلاق

- `platform.mode=FREE_LAUNCH` في قاعدة البيانات: المسودة الصحيحة تنشر مباشرة إلى `ACTIVE`.
- `payments.enabled=false` و`PAYMENTS_ENABLED=false` افتراضيًا.
- لا توجد نتيجة دفع تجريبية أو زر نجاح وهمي.
- عند الانتقال إلى `PAID_ONLY` لا ينشط الإعلان إلا من webhook موثق لمزود الدفع.
- المنشورات في جدول وAPI منفصلين، وتظهر فقط داخل صفحة صاحب الحساب.
- أسعار المنتج تحفظ في `PricingItem` وتعدل حصريًا عبر لوحة الإدارة؛ الأرقام الابتدائية موجودة
  في seed وليست ثوابت في الواجهات.

## حساب الإدارة في Sandbox

لا يوجد OTP ثابت ظاهر للمستخدم. في البيئة غير الإنتاجية فقط:

1. عيّن `SEED_SANDBOX_ADMIN_PHONE` في `.env`.
2. شغّل `pnpm db:seed`.
3. اطلب OTP من شاشة إدارة الدخول.
4. عند `OTP_PROVIDER=console` يظهر الرمز المؤقت في سجل API فقط.

مزود `console` يتوقف برمجيًا في `NODE_ENV=production`. الإنتاج يتطلب مزود OTP خارجي.

## التحقق والبناء

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm archive
```

ينشئ الأمر الأخير `release/e3lani-platform.zip`.

## المزايا المنفذة

- تسجيل جوال وOTP عبر Adapter، جلسات JWT قابلة للإبطال وتدوير refresh token.
- حسابات فرد/متجر/براند/شركة، ملف تجاري، صور حساب وشعار وغلاف.
- موجز عمودي، صور متعددة، فيديو تلقائي صامت، إيقاف خارج المشهد، ومفتاح صوت.
- إنشاء إعلان مع فحص ملكية الوسائط والروابط والنوع والعدد والنطاق.
- ضغط صور WebP، نسخ متعددة، تحويل فيديو MP4، thumbnail، وحد 60 ثانية.
- بحث وفلاتر، أقسام ومدن، حفظ ومشاركة، صفحات معلن عامة.
- فصل كامل بين `Ad` و`ProfilePost` في قاعدة البيانات والـ API.
- بلاغات واعتراضات وقرارات إشراف مع إشعارات وAudit Log.
- تحليلات أحداث الإعلانات ومصادر الظهور وواجهة ملخص للمالك.
- شريط شعارات غير قابل للنقر ولا يتوقف باللمس.
- RBAC خادمي لأدوار الإدارة المطلوبة وإدارة الأسعار والبلاغات والاعتراضات والمستخدمين والشريط.
- Payment Adapter مع Moyasar ومسار webhook موثق، مع تعطيل آمن افتراضيًا.

## الربط الخارجي

راجع [دليل الخدمات الخارجية](./docs/external-services.md) و[معمارية المنصة](./docs/architecture.md).
