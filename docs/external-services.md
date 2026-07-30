# ربط الخدمات الخارجية

## الخدمات التي تحتاج مفاتيح

| الخدمة | إلزامية للإنتاج | المتغيرات |
|---|---:|---|
| PostgreSQL مُدار | نعم | `DATABASE_URL` |
| Redis مُدار | نعم | `REDIS_URL` |
| S3 أو MinIO | نعم | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| مزود OTP (Unifonic) | نعم | `OTP_PROVIDER=unifonic`, `UNIFONIC_APP_SID`, `UNIFONIC_SENDER_ID` |
| Moyasar | عند تفعيل الدفع | `PAYMENTS_ENABLED=true`, `PAYMENT_PROVIDER=moyasar`, `MOYASAR_SECRET_KEY`, `MOYASAR_WEBHOOK_SECRET` |
| Push Notifications | مطلوب للإشعارات الفورية | بيانات Expo Push أو APNs/FCM عند إضافة قناة الإرسال |
| CDN | موصى به | اضبط `S3_PUBLIC_URL` في عامل الوسائط |

## S3

أنشئ bucket خاصًا للرفع، واسمح لخدمة API بعمليات `PutObject`/`HeadObject` وللعامل
بعمليات `GetObject`/`PutObject`. روابط الرفع موقعة ومحددة المدة. إذا كانت المشتقات عامة،
ضع CDN أمامها واضبط `S3_PUBLIC_URL`. لا تمنح تطبيق الجوال مفاتيح S3.

## OTP

`console` مخصص للتطوير ويتوقف في production. عند Unifonic:

1. فعّل Sender ID معتمدًا.
2. ضع AppSid في مدير الأسرار.
3. اضبط `OTP_PROVIDER=unifonic`.
4. اختبر حدود المعدل، الأرقام السعودية، ورسائل الفشل قبل الإطلاق.

رمز OTP لا يعاد للعميل في استجابة API ولا يوجد رمز ثابت.

## Moyasar

1. ابدأ بمفاتيح test على بيئة staging.
2. سجل webhook إلى `POST /api/v1/payments/webhooks/moyasar`.
3. ضع سر webhook مستقلًا وتحقق أن البوابة ترسل `x-moyasar-signature`.
4. نفذ اختبار replay/idempotency ثم بدّل إلى مفاتيح live.
5. عدل `payments.enabled` في قاعدة البيانات و`PAYMENTS_ENABLED` في بيئة الخدمة معًا.
6. غيّر `platform.mode` إلى `PAID_ONLY` فقط بعد نجاح webhook فعلي.

لا ينشط redirect المتصفح الإعلان؛ webhook الموثق وحده يفعل ذلك.

## الإشعارات

قاعدة البيانات وواجهات قراءة الإشعارات موجودة. للإرسال الفوري اربط عاملًا منفصلًا بـ Expo
Push Service أو APNs/FCM، واحفظ device tokens مشفرة أو محمية. فشل push لا يجب أن يلغي
الإشعار داخل المنصة.

## أسرار الإنتاج

- أنشئ قيمًا عشوائية بطول 32 بايت أو أكثر لـ `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `OTP_HASH_SECRET`.
- استخدم Secret Manager ولا تحفظ `.env` الحقيقي في Git.
- دوّر مفاتيح refresh وS3 والدفع وفق سياسة تشغيلية.
- افصل buckets وقواعد البيانات بين development وstaging وproduction.
