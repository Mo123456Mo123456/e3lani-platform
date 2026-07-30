# إعلاني | E3lani

**منصة الإعلانات المرئية لكل شيء**

منصة سعودية للإعلانات المرئية وليست متجرًا إلكترونيًا. يتصفح الزائر إعلانًا بعد إعلان، ثم ينتقل مباشرة إلى واتساب أو الاتصال أو متجر/رابط المعلن. لا توجد سلة أو بيع أو عمولة أو مزاد أو محادثات أو تعليقات.

## المعمارية

```text
apps/
  mobile         Expo + React Native + Expo Router
  web            Next.js 15 App Router
  admin          Next.js 15 App Router (staff only)
services/
  api            NestJS REST API
  media-worker   BullMQ + FFmpeg + sharp
packages/
  database       PostgreSQL + Prisma
  types          TypeScript + Zod
  ui             Tailwind CSS + shadcn-style primitives
  config         validated environment configuration
  eslint-config
  tsconfig
```

المصدر التشغيلي الوحيد للبيانات هو PostgreSQL. Redis مخصص للمهام وحدود المعدل، وS3 للوسائط. المنشورات المجانية (`ProfilePost`) منفصلة بنيويًا واستعلاميًا عن الإعلانات (`Ad`) ولا تدخل موجز الإعلانات.

## التشغيل المحلي

المتطلبات: Node.js 22+، pnpm 10، Docker مع Compose، وFFmpeg عند تشغيل العامل خارج الحاويات.

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

العناوين الافتراضية:

- الموقع العام: `http://localhost:3000`
- لوحة الإدارة: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- MinIO: `http://localhost:9001`
- Expo: يظهر عنوانه في مخرجات Metro

تشغيل خدمة منفردة:

```bash
pnpm --filter @e3lani/api dev
pnpm --filter @e3lani/media-worker dev
pnpm --filter @e3lani/web dev
pnpm --filter @e3lani/admin dev
pnpm --filter @e3lani/mobile dev
```

## إعدادات الإطلاق الآمنة

- `FREE_LAUNCH` هو الوضع المزروع افتراضيًا: `DRAFT → ACTIVE` بعد الفحص الآلي، دون مراجعة بشرية.
- `PAYMENTS_ENABLED=false` افتراضيًا. مسار الدفع يعيد `PAYMENTS_DISABLED` ولا يمكنه إظهار نجاح وهمي.
- الأسعار محفوظة في جدول `Price` وتُعدّل عبر لوحة الإدارة، ولا تعتمد الواجهات على قيم أسعار مكتوبة داخلها.
- OTP الثابت غير موجود. مزود `console` يعمل في التطوير فقط ويطبع رمزًا عشوائيًا في سجل API.
- الوصول الإداري محمي مرة ثانية في API بأدوار RBAC؛ إخفاء عناصر الواجهة ليس آلية الحماية.
- شعارات الشريط العامة لا تحتوي API خاصًا للرابط، والواجهة تجعل الشريط غير قابل للمس.

## حساب إدارة Sandbox

بعد `pnpm db:seed`:

- الجوال: `+966500000001` (أو قيمة `SEED_ADMIN_PHONE`)
- الدور: `SUPER_ADMIN`
- رمز OTP: عشوائي ويظهر في سجل API عند الطلب، في بيئة التطوير فقط

لا توجد كلمة مرور أو شفرة OTP ثابتة. يجب ربط مزود SMS قبل الإنتاج.

## الوظائف المنفذة

- OTP/JWT، جلسات قابلة للإلغاء، حد للمحاولات، وملف فردي/تجاري.
- موجز عمودي مستقل لأنماط «لك»، «قريب منك»، و«الأحدث»، مع بحث وفلاتر API.
- فيديو حتى 60 ثانية أو 1–5 صور، رفع موقّع، تحقق من التوقيع الفعلي، ضغط، thumbnail، وfast-start.
- نشر مجاني مباشر، وسائل تواصل خارجية آمنة، حفظ، مشاركة، بلاغات، واعتراضات على مستوى البيانات.
- صفحات عامة للإعلان وصاحب الحساب، مع تبويبي الإعلانات والمنشورات وSEO/Open Graph.
- منشورات مجانية منفصلة، شعارات شريط غير قابلة للنقر، إشعارات، أحداث تحليلية، وسجل تدقيق.
- أسعار ديناميكية وPayment Adapter مع إيقاف آمن افتراضي.
- لوحة إدارة مستقلة مع RBAC لإدارة المستخدمين، الإعلانات، البلاغات، الشعارات، الأسعار، والتحليلات والسجل.
- PostgreSQL migrations وبذور idempotent للبنية والأسعار والأقسام والمدن وحساب Sandbox.

## فحوص الجودة

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## الخدمات التي تحتاج مفاتيح خارجية

| الخدمة | مطلوبة محليًا | متغيرات الإنتاج |
|---|---:|---|
| SMS/OTP | لا، `console` | `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID` |
| S3-compatible | MinIO محلي | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` |
| الدفع | لا، معطل | `PAYMENT_PROVIDER`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET` |
| Push | لا، `console` | `EXPO_ACCESS_TOKEN` |
| فحص المحتوى المتقدم | لا، فحص أساسي | `CONTENT_SAFETY_API_KEY` |
| مراقبة الأخطاء | اختياري | `SENTRY_DSN` |

تفاصيل الربط وضوابط الإنتاج في [دليل الخدمات الخارجية](./docs/external-services.md).
