# Staging دائم — حالة النشر

## الحكم

Staging الدائم على Render **منشور**:

| Service | URL |
|---|---|
| Web | https://e3lani-web-staging.onrender.com |
| Admin | https://e3lani-admin-staging.onrender.com |
| API | https://e3lani-api-staging.onrender.com/api/v1/health |
| Android v5 | https://github.com/Mo123456Mo123456/e3lani-platform/releases/download/visual-qa-phase3/e3lani-staging-release-v5.apk |

المتبقي للمسار الكامل: ضبط `S3_*` على خدمة API (الرفع يعيد `STORAGE_NOT_CONFIGURED`).

<details><summary>سجل الحظر السابق (قبل Render)</summary>

لا يمكن إكمال **Staging دائم** من داخل وكيل Cursor الحالي بدون مفتاح API لمنصة استضافة.

تم التحقق من:

| المسار | النتيجة |
|---|---|
| Cloudflare quick tunnel | مرفوض للتسليم (HTTP 530 بعد انتهاء الجلسة) |
| منافذ VM العامة | مغلقة من الخارج |
| Fly.io / Railway / Vercel CLI | تحتاج تسجيل دخول تفاعلي (OAuth) |
| GHCR push | `permission_denied` لحساب التكامل الحالي |
| Codespaces | `403` على التكامل الحالي |
| Secrets المستودع | غير مقروءة (`403`) |

## ما جاهز في المستودع

- `infrastructure/docker/Dockerfile.api` — صورة NestJS API (بُنيت محليًا بنجاح: `ghcr.io/mo123456mo123456/e3lani-api:staging`)
- `render.yaml` — Blueprint لـ API + Web + Admin + Postgres + Redis على Render Free
- `scripts/deploy-staging-render.sh` — نشر عبر Render API

## المطلوب من مالك الحساب (مرة واحدة)

1. أنشئ حسابًا على [Render](https://render.com) (بدون بطاقة للخطة المجانية) واربط مستودع GitHub `Mo123456Mo123456/e3lani-platform`.
2. أنشئ API Key من Dashboard → Account Settings → API Keys.
3. أعد تشغيل الوكيل مع المتغير:

```bash
export RENDER_API_KEY=rnd_...
bash scripts/deploy-staging-render.sh
```

أو من واجهة Render: **New → Blueprint** → اختر المستودع والفرع `cursor/phase-1-foundation-b0e4` → طبّق `render.yaml`.

### إصلاح EROFS / corepack (مهم)

لا تستخدم `corepack enable` على Render Node — يفشل بـ `EROFS: unlink '/usr/bin/pnpm'`.
`render.yaml` يثبّت `pnpm@9.15.4` تحت `$HOME/.local` ويشغّل Node/Prisma/Next مباشرة بدون pnpm في `startCommand`.

بعد دفع التعديل: من Blueprint اضغط **Manual Sync** ثم أعد البناء.

4. بعد ظهور الخدمات، عيّن:

- `API_PUBLIC_URL=https://e3lani-api-staging.onrender.com`
- `CORS_ORIGINS=https://e3lani-web-staging.onrender.com,https://e3lani-admin-staging.onrender.com`
- تخزين كائنات (Cloudflare R2 / AWS S3 / Backblaze) في `S3_*`

5. تحقق:

```bash
curl https://e3lani-api-staging.onrender.com/api/v1/health
```

6. ابنِ APK مرتبطًا بالعنوان الثابت فقط (بدون `trycloudflare`):

```bash
EXPO_PUBLIC_API_URL=https://e3lani-api-staging.onrender.com/api/v1 \
  pnpm --filter @e3lani/mobile build:android:staging-release
```

## ملاحظة عن الدومين

`api-staging.e3lani.com` يحتاج نطاقًا مملوكًا + DNS. إلى أن يتوفر، استخدم `*.onrender.com` كعنوان ثابت (ليس نفقًا مؤقتًا).

## Android

لن يُبنى APK جديد على `trycloudflare`. Android **غير جاهز للتسليم النهائي** حتى يعمل Health الثابت من جهازك ثم يُعاد بناء APK عليه.
