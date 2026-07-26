# حالة التسليم — إعلاني | E3lani

**تاريخ التحديث:** 27 يوليو 2026  
**الفرع:** `cursor/phase-1-foundation-b0e4`  
**الحالة العامة:** نواة تقنية أولية (Phase 1) — **جاهز تقنيًا للاختبار/Sandbox، وليس جاهزًا لتحصيل أموال حقيقية أو الإطلاق الإنتاجي.**

## ما تم فحصه

- المستودع كان يحتوي `README` فقط على `main`.
- فرع `build/phase-1-foundation` يحتوي مواصفات ومرجع هوية فقط.
- لا يوجد كود تطبيقات/API سابق لاستكماله — بدأ التأسيس من المواصفات المعتمدة.

## ما نُفّذ في هذه المرحلة

- Monorepo: `pnpm` + Turborepo + TypeScript strict.
- حزم: `types`, `config`, `validation`, `auth`, `payments`, `i18n`, `ui`.
- API NestJS: Auth OTP sandbox، Users، Categories، Geo، Ads/Revisions، Feed، Orders/Payment options، Health.
- Prisma schema لنماذج النواة + seed (21 قسمًا، مدن السعودية، تسعير 59 ر.س، مزودو دفع معطلون).
- آلة حالات الإعلان: المراجعة قبل الدفع.
- Payment routing + pricing engine (بدون تفعيل مزود حقيقي).
- تطبيق جوال Expo (Feed / أقسام / إنشاء / محفوظات / حساب).
- ويب Next.js (رئيسية + تصفح + أسعار) ولوحة إدارة أولية.
- Media worker scaffold.
- Docker Compose: Postgres / Redis / MinIO.
- توثيق: PRODUCT_SPEC، سياسة الإعلانات، المفاتيح، مصفوفة التنفيذ.

## الاختبارات

تُشغَّل عبر `pnpm test` على الحزم الحرجة (state machine، OTP sandbox، routing، pricing، media host checks).

## المتبقي (الخطوة التالية الدقيقة)

1. Migrations فعلية على Postgres + ربط OTP الإنتاجي عند توفر المفاتيح.
2. رفع الوسائط (presigned) + FFmpeg worker.
3. مسار مراجعة الإدارة الكامل + تفعيل Webhooks لمزود إقليمي واحد في Sandbox.
4. ربط الجوال/الويب بالـ API بدل البيانات التجريبية.
5. StoreKit / Google Play Billing adapters مع تحقق خادمي.

## المفاتيح المطلوبة قبل Production

انظر `docs/KEYS_AND_ACCOUNTS_AR.md`. لا مزود دفع مفعّل حاليًا — زر الدفع يبقى غير نشط حتى تفعيل مزود بمفاتيح حقيقية.
