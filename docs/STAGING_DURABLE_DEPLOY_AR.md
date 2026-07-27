# Staging دائم — حالة النشر

## الحكم

Staging الدائم على Render **منشور**:

| Service | URL |
|---|---|
| Web | https://e3lani-web-staging.onrender.com |
| Admin | https://e3lani-admin-staging.onrender.com |
| API Health | https://e3lani-api-staging.onrender.com/api/v1/health |
| Android v5 | https://github.com/Mo123456Mo123456/e3lani-platform/releases/download/visual-qa-phase3/e3lani-staging-release-v5.apk |

| Field | Value |
|---|---|
| versionName | `0.1.5-staging` |
| versionCode | `5` |
| SHA-256 | `ba49bde90a6ec225baf55b81bc8e61ade8818ac8d8f9725e68f6afcdb30a3cfe` |

تم التحقق من API: OTP `123456` → Feed → إنشاء إعلان (DRAFT).  
رفع الوسائط يعتمد على Cloudflare R2 (انظر أدناه).

## Cloudflare R2 — تخزين الوسائط

لا تضع أسرارًا في Git. عيّن القيم من لوحة Cloudflare ثم انقلها إلى Render Environment.

### صفحة إعداد R2

https://dash.cloudflare.com/?to=/:account/r2

### المتغيرات المطلوبة (API)

| Variable | Source |
|---|---|
| `STORAGE_PROVIDER` | ثابت: `r2` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (sync:false على Render) |
| `R2_BUCKET` | مثل `e3lani-staging-media` |
| `R2_ACCESS_KEY_ID` | R2 API Token → Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key (يُعرض مرة واحدة) |

AWS SDK داخليًا: `region=auto`, `forcePathStyle=false`. Health يعرض `storage.missing` بأسماء `R2_*` عند النقص.

### إعداد Bucket CORS (مطلوب للرفع من المتصفح/الجوال)

في R2 → Bucket → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": [
      "https://e3lani-web-staging.onrender.com",
      "https://e3lani-admin-staging.onrender.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Authorization", "*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

تطبيق Android يرفع عبر Signed URL مباشرة إلى R2 (لا يحتاج Origin ثابت في CORS بنفس أسلوب المتصفح؛ أبقِ PUT مفعّلًا).

### Bucket خاص + Signed URLs

- لا تجعل كل الملفات عامة تلقائيًا.
- Bucket خاص + Signed GET افتراضيًا (بدون عنوان عام).
- الرفع: Signed PUT من `/media/upload-intent`.

### بعد ضبط المتغيرات على Render

1. Dashboard → `e3lani-api-staging` → Environment → الصق المتغيرات.
2. Dashboard → `e3lani-media-worker-staging` → نفس متغيرات التخزين + `DATABASE_URL`/`REDIS_URL` (من Blueprint).
3. Manual Deploy للـAPI والـWorker.
4. تحقق:

```bash
curl -sS https://e3lani-api-staging.onrender.com/api/v1/health
# storage.configured يجب أن يصبح true بعد ضبط R2

# إداري (يتطلب Bearer token بمراجع):
curl -sS -H "Authorization: Bearer <token>" \
  https://e3lani-api-staging.onrender.com/api/v1/admin/providers/storage/health
```

### مسار الوسائط

```
Client → POST /media/upload-intent (Signed PUT)
      → PUT مباشر إلى R2
      → POST /media/:id/complete  (UPLOADED → QUEUED)
      → media-worker (PROCESSING → FFmpeg/Sharp → processed/* على R2 → READY)
      → POST /ads/:id/media
      → POST /ads/:id/submit-review
```

حالات `MediaAsset.status`: `UPLOADING` → `UPLOADED` → `QUEUED` → `PROCESSING` → `READY` | `FAILED`.

## ملاحظات Render

لا تستخدم `corepack enable` على Render Node — يفشل بـ `EROFS`.  
`render.yaml` يثبّت `pnpm@9.15.4` تحت `$HOME/.local`.

API يطبّق bootstrap seed تلقائيًا (21 فئة + مدن السعودية) إذا كانت قاعدة البيانات فارغة.

`e3lani-media-worker-staging` صورة Docker تتضمن FFmpeg.

## بناء APK

عنوان API لم يتغير — **APK v5 يكفي** ما لم يتغير كود الجوال أو عنوان الـAPI.

```bash
EXPO_PUBLIC_API_URL=https://e3lani-api-staging.onrender.com/api/v1 \
  pnpm --filter @e3lani/mobile build:android:staging-release
```

## الدومين

`api-staging.e3lani.com` يحتاج نطاقًا مملوكًا + DNS. حتى يتوفر، `*.onrender.com` عنوان ثابت صالح.
