# المفاتيح والحسابات — إعلاني | E3lani

> لا تُحفظ أسرار حقيقية داخل المستودع. استخدم Secret Manager / Render Environment في الإنتاج وStaging.

| الخدمة | الغرض | متغيرات أساسية | ملاحظات |
|---|---|---|---|
| PostgreSQL | قاعدة البيانات | `DATABASE_URL` | إلزامي |
| Redis | جلسات/طوابير وسائط | `REDIS_URL` | إلزامي للطوابير |
| JWT | مصادقة | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | تدوير عند التسريب |
| OTP | تسجيل الدخول | `OTP_MODE`, `OTP_PROVIDER`, مفاتيح Unifonic/Twilio/SNS | Production يفشل بدون مفاتيح |
| Object Storage (R2/S3/MinIO) | وسائط | انظر الجدول أدناه | S3-compatible عبر AWS SDK v3 |
| Moyasar | دفع سعودي | `MOYASAR_SECRET_KEY` | Hosted Checkout |
| HyperPay | دفع إقليمي | `HYPERPAY_ACCESS_TOKEN` | |
| MyFatoorah | دفع خليجي | `MYFATOORAH_API_KEY` | |
| Tap | دفع إقليمي | `TAP_SECRET_KEY` | |
| PayTabs | دفع إقليمي | `PAYTABS_PROFILE_ID` | |
| Stripe | دولي | `STRIPE_SECRET_KEY` | حسب الأهلية |
| PayPal | ويب | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Business مؤهل |
| Apple IAP | iOS | `APPLE_ISSUER_ID`, مفاتيح App Store Server API | تحقق خادمي |
| Google Play | Android | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | RTDN + acknowledgement |
| Moderation AI | مساعدة مراجعة | `MODERATION_PROVIDER` | اختياري؛ قواعد محلية عند الغياب |

## Object Storage — Cloudflare R2 (Staging الموصى به)

لوحة التحكم: https://dash.cloudflare.com/?to=/:account/r2

| Variable | مثال / مصدر | سري؟ |
|---|---|---|
| `STORAGE_PROVIDER` | `r2` | لا |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | لا (معرّف الحساب) |
| `S3_REGION` | `auto` | لا |
| `S3_BUCKET` | اسم الـBucket | لا |
| `S3_ACCESS_KEY_ID` | R2 API Token → Access Key ID | نعم |
| `S3_SECRET_ACCESS_KEY` | R2 API Token → Secret | نعم |
| `S3_PUBLIC_BASE_URL` | فارغ للـprivate + Signed GET؛ أو نطاق عام اختياري | لا |
| `S3_FORCE_PATH_STYLE` | `false` لـR2 | لا |

توافق خلفي: `S3_ACCESS_KEY` / `S3_SECRET_KEY` ما زالا يُقرآن إن لم تُضبط الأسماء الجديدة.

### صلاحيات توكن R2

- Object Read & Write على الـBucket الخاص بالوسائط.
- لا تمنح صلاحيات حساب كاملة إن لم تكن ضرورية.

### فحص الصحة (بدون كشف أسرار)

- عام: `GET /api/v1/health` → `storage.configured` / `storage.provider`
- إداري: `GET /api/v1/admin/providers/storage/health` → `{ healthy, message, missing, … }` بدون مفاتيح

## Sandbox مقابل Production

- `PAYMENT_MODE=sandbox` و `OTP_MODE=sandbox` للتطوير المحلي فقط.
- Sandbox OTP المعلن: `123456`.
- Production/Staging: Fail Closed للوسائط — لا نجاح وهمي عند نقص `S3_*`.
- Health العام يبقى `ok` حتى لو التخزين غير مضبوط؛ الرفع يعيد `503 STORAGE_NOT_CONFIGURED` أو `STORAGE_MISCONFIGURED`.
- Webhooks تتطلب تحقق التوقيع وIdempotency عبر `eventId` فريد.
