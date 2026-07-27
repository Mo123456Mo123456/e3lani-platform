# تقرير المرحلة الثالثة — إعلاني | E3lani

**الفرع:** `cursor/phase-1-foundation-b0e4`  
**PR:** #2 (Draft)  
**الحالة:** واجهات مربوطة بالـAPI الحقيقي + مسار مستخدم كامل قابل للتشغيل في Sandbox.

## ما نُفّذ

1. حزمة `@e3lani/api-client` مشتركة للويب والجوال والإدارة.
2. إزالة بيانات Demo/Mock من المسارات الأساسية في Expo والويب ولوحة الإدارة.
3. مسار المستخدم الكامل:
   OTP Sandbox → الرئيسية/التصفح → إنشاء إعلان → رفع صورة/فيديو → حالات الوسائط → إرسال للمراجعة → مراجعة الإدارة → الدفع بعد القبول فقط → Sandbox + Webhook → تفعيل → Feed.
4. واجهات مكتملة: الرئيسية، التصفح العمودي، الأقسام، إضافة إعلان، حالة الإعلان، الدفع، الحساب، المحفوظات، صفحة الإعلان، صفحة البراند، مراجعة الإدارة، مدفوعات الإدارة.
5. معالجة فيديو حقيقية (MP4/MOV، 60 ثانية، 200MB، FFmpeg، Thumbnail، حالات UPLOADING/PROCESSING/READY/FAILED، تشغيل من MinIO).
6. تسعير معتمد دون تغيير: 59 / 10 / 29 / 15 / 29 / 29 / 10 ر.س.
7. اختبارات Playwright E2E للمسار الكامل + دخان API للجوال.

## نتائج التحقق (27 يوليو 2026)

| الأمر | النتيجة |
|---|---|
| `pnpm typecheck` | ناجح |
| `pnpm lint` | ناجح |
| `pnpm test` | ناجح |
| `pnpm test:integration` | `PHASE2_INTEGRATION_OK` |
| `pnpm build` | ناجح |
| `pnpm test:e2e` | ناجح (2/2) |

## إثبات مرئي للمسار

اللقطات تحت `/opt/cursor/artifacts/`:

1. `01-account.png` — بعد OTP
2. `02-ad-pending-review.png` — قيد المراجعة بعد رفع فيديو
3. `03-admin-review.png` — ظهور الإعلان في لوحة الإدارة
4. `03b-admin-payments.png` — شاشة المدفوعات
5. `04-awaiting-payment.png` — مقبول بانتظار الدفع
6. `05-payment.png` — شاشة الدفع 59 ر.س
7. `06-sandbox-checkout-webhook.png` — Webhook يفعّل الإعلان
8. `07-ad-active.png` — حالة نشط
9. `07b-ad-video-player.png` — مشغّل فيديو من MinIO
10. `08-feed-with-ad.png` — ظهور في Feed
11. `09-redirect-does-not-publish.png` — Redirect لا ينشر

## ملاحظات Sandbox

- التفعيل يتم فقط عبر Webhook موقّع؛ Redirect لا ينشر الإعلان.
- في `PAYMENT_MODE=sandbox` يمكن لأي مستخدم مصادَق مراجعة الإعلانات محليًا.
- الـPR يبقى Draft؛ Issue #1 لا يُغلق قبل الاكتمال المرئي ونجاح الاختبارات (تم استيفاؤهما في هذه المرحلة).
