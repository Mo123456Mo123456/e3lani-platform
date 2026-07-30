# إعلاني | E3lani

**منصة الإعلانات المرئية لكل شيء**

منصة سعودية لعرض الصور والفيديوهات الإعلانية القصيرة والتواصل المباشر مع المعلن. ليست متجرًا إلكترونيًا: لا بيع داخل المنصة، ولا سلة، ولا توصيل، ولا عمولة، ولا مزاد، ولا محادثات أو تعليقات.

## البنية

```text
apps/
  mobile          Expo + Expo Router
  web             Next.js 15 للموقع العام وSEO
  admin           Next.js 15 للموظفين فقط
services/
  api             NestJS + JWT/OTP + RBAC
  media-worker    BullMQ + sharp + FFmpeg
packages/
  database        Prisma 7 + PostgreSQL
  types           Zod وعقود TypeScript
  ui              Tailwind CSS ومكونات shadcn-style
  config          الهوية والتحقق من ENV
  eslint-config
  tsconfig
```

المصدر المركزي للحقيقة هو PostgreSQL. يحتفظ تطبيق الجوال محليًا بالتفضيلات ورمز الجلسة الآمن فقط. المنشورات المجانية موجودة في `profile_posts`، والتوزيع الإعلاني في `ad_distributions`، ولا يدخل أي منشور مجاني إلى الموجز دون سجل توزيع مستقل.

## المتطلبات

- Node.js 22+
- pnpm 10+
- Docker مع Docker Compose للتشغيل المحلي
- FFmpeg (العامل يستخدم `ffmpeg-static` افتراضيًا)

## التشغيل المحلي

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

الخدمات:

- الموقع العام: `http://localhost:3000`
- لوحة الإدارة: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`
- MinIO Console: `http://localhost:9001`

يمكن تشغيل كل جزء منفردًا:

```bash
pnpm --filter @e3lani/api dev
pnpm --filter @e3lani/media-worker dev
pnpm --filter @e3lani/web dev
pnpm --filter @e3lani/admin dev
pnpm --filter @e3lani/mobile dev
```

## وضع الإطلاق والدفع

البذور تضبط:

- `platform.mode = FREE_LAUNCH`
- `payments.enabled = false`
- مدة الإعلان الافتراضية 30 يومًا

لذلك المسار الحالي: مسودة ← نشر المنشور ← إنشاء توزيع نشط مباشرة بعد الفحص الآلي. لا توجد شاشة نجاح دفع أو عملية دفع وهمية. لا يمكن تفعيل الدفع من لوحة الإدارة عندما يكون `PAYMENT_PROVIDER=disabled`.

الأسعار محفوظة في `pricing_versions` و`pricing_rules` وقابلة للتعديل من لوحة الإدارة. لا تُعرض أثناء وضع الإطلاق المجاني.

## حساب الإدارة في Sandbox

لا يُنشأ حساب إدارة افتراضيًا. لإنشاء حساب محلي فقط:

```bash
SEED_SANDBOX=true pnpm db:seed
```

- الجوال: `+966500000001`
- لا توجد كلمة مرور أو OTP ثابتة.
- في التطوير يطبع `ConsoleOtpAdapter` رمزًا عشوائيًا في سجل API.
- يرفض `ConsoleOtpAdapter` العمل في `NODE_ENV=production`.

لا تستخدم `SEED_SANDBOX=true` في الإنتاج.

## الجودة

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## الخدمات الخارجية

راجع [`docs/external-services.md`](docs/external-services.md) لمزود OTP، التخزين، الدفع، الإشعارات والمراقبة. جميع الأسرار تُمرر عبر ENV ولا تُضمّن في تطبيقات العميل.

## إنشاء ملف التسليم

بعد commit نهائي:

```bash
pnpm zip
```

ينشئ `artifacts/e3lani-platform.zip` من الملفات المتتبعة فقط، دون `.env` أو `node_modules` أو نواتج البناء.
