# حالة التسليم — إعلاني | E3lani

**تاريخ التحديث:** 27 يوليو 2026  
**الفرع:** `cursor/phase-1-foundation-b0e4`  
**PR:** #2  
**الحالة العامة:** Phase 2 مكتملة تقنيًا للاختبار/Sandbox — **ليست جاهزة لتحصيل أموال حقيقية أو الإطلاق الإنتاجي.**

## ما تم فحصه

- Docker Compose: PostgreSQL + Redis + MinIO يعملان.
- Prisma migrate deploy + seed (تسعير 59 ر.س مؤكد).
- اختبار تكامل حي: مستخدم → إعلان → إصدار → رفع وسائط → مراجعة → دفع sandbox → webhook.

## ما نُفّذ في Phase 2

- Signed URL uploads (`POST /media/upload-intent` → PUT → `/complete`)
- Media Worker: صور (sharp thumbnail) + فيديو (ffmpeg poster/720p) عبر Redis queue
- دورة المراجعة: DRAFT → PENDING_REVIEW → NEEDS_CHANGES | APPROVED_AWAITING_PAYMENT
- مزود دفع `sandbox` مع توقيع HMAC ونافذة replay وIdempotency
- منع التفعيل عبر redirect (`POST /orders/:id/verify-redirect` يعيد activated:false)
- التفعيل فقط بعد Webhook موقّع + verifyPayment خادمي

## التسعير المعتمد (لم يُغيَّر)

| الخدمة | السعر |
|---|---|
| إعلان 30 يومًا | 59 ر.س |
| إعادة نشر | 10 ر.س |
| تمديد 15 يومًا | 29 ر.س |
| إبراز 3/7 أيام | 15 / 29 ر.س |
| أعلى القسم | 29 ر.س |
| مدينة إضافية | 10 ر.س |

## نتائج التحقق

- `pnpm test` — ناجح
- `node scripts/phase2-integration.mjs` — `PHASE2_INTEGRATION_OK`
- بناء API / Web / Admin / packages — يُحدَّث في تقرير الجلسة

## المتبقي

1. StoreKit / Google Play Billing adapters مع تحقق خادمي حقيقي
2. مزود إقليمي إنتاجي (Moyasar/MyFatoorah) بمفاتيح تاجر
3. ربط واجهات الجوال/الويب بالـ API بدل demo data
4. E2E Playwright + مراقبة إنتاجية
5. MFA للإدارة وSecret Manager

## المفاتيح المطلوبة قبل Production

انظر `docs/KEYS_AND_ACCOUNTS_AR.md`.
