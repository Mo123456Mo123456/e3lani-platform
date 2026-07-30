# ربط الخدمات الخارجية

## 1. PostgreSQL

اضبط `DATABASE_URL` بصيغة PostgreSQL وشغّل:

```bash
pnpm db:migrate
pnpm db:seed
```

استخدم مستخدم قاعدة محدود الصلاحيات في التشغيل، ومستخدم ترحيلات مستقلًا في CI/CD عند الإمكان. فعّل النسخ الاحتياطي والاستعادة إلى نقطة زمنية لدى المزود.

## 2. Redis

اضبط `REDIS_URL` باتصال TLS في الإنتاج. يستخدمه BullMQ لمعالجة الوسائط. لا تشارك Redis مع أحمال غير موثوقة، وفعّل كلمة مرور وسياسة eviction لا تحذف مفاتيح الطوابير.

## 3. التخزين S3-compatible

المتغيرات المطلوبة:

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_PUBLIC_URL`
- `S3_FORCE_PATH_STYLE`

محليًا يوفر MinIO هذه الخدمة. في الإنتاج أنشئ مستخدمًا يستطيع القراءة والكتابة والحذف داخل bucket إعلاني فقط. يرفع العميل عبر رابط PUT موقّع، ثم يتحقق الـAPI من الحجم والنوع قبل إضافة مهمة BullMQ. لا تمنح تطبيق الجوال مفاتيح S3.

## 4. OTP / SMS

العقد `OtpProvider` ومحوّل HTTP عام لمزود الرسائل موجودان في `services/api/src/modules/auth.ts`. المزود المحلي يطبع رمزًا عشوائيًا ويُحظر تلقائيًا في الإنتاج. قبل الإطلاق:

1. اضبط `SMS_PROVIDER_URL` على endpoint مزود رسائل سعودي مرخص.
2. استخدم `SMS_PROVIDER_API_KEY` و`SMS_PROVIDER_SENDER_ID` من مدير أسرار.
3. لا تسجل رمز OTP أو رقم الجوال كاملًا في production logs.
4. اختبر حدود المحاولات، انتهاء الرمز، الحظر المؤقت، وتسليم الرسائل.

## 5. الدفع

`PaymentProvider` معطّل افتراضيًا ويرفض كل عملية. لتفعيل مزود حقيقي:

1. نفّذ `createPayment` و`verifyWebhook` و`refund`.
2. تحقق من توقيع webhook من `PAYMENT_WEBHOOK_SECRET`.
3. استخدم `Order.idempotencyKey` و`providerRef` لمنع التكرار.
4. لا تجعل العودة من صفحة المزود دليل نجاح؛ الحالة `PAID` لا تتغير إلا بعد webhook موثوق.
5. اضبط `PAYMENT_PROVIDER` ثم فعّل `payments.enabled` من لوحة الإدارة.

المزودات المرشحة: Moyasar أو HyperPay وفق العقد التجاري ومتطلبات مدى.

## 6. الإشعارات

تُحفظ الإشعارات داخل جدول `notifications`. لإرسال push:

- Expo Push: `EXPO_ACCESS_TOKEN`
- أو APNs/FCM مباشرة عبر Adapter مستقل

احترم تفضيلات المستخدم، وعطّل token عند استجابة المزود بأنه غير صالح.

## 7. المراقبة

اضبط `SENTRY_DSN` أو مزود OpenTelemetry. لا ترسل أرقام الجوال، رموز OTP، JWT، روابط S3 الموقعة، أو أجسام webhooks إلى منصة المراقبة.

## 8. النطاقات والروابط

اضبط:

- `WEB_URL`
- `ADMIN_URL`
- `NEXT_PUBLIC_API_URL`
- `EXPO_PUBLIC_API_URL`

استخدم HTTPS فقط في الإنتاج، واقصر CORS على نطاقي الويب والإدارة. يجب أن تكون لوحة الإدارة على نطاق منفصل ومحمي بسياسة وصول الموظفين.
