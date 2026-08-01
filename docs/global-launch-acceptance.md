# معيار قبول الإطلاق العالمي — تحديث الفرع

## ما هو مكتمل في الكود

| # | المعيار | الحالة |
|---|---------|--------|
| 1 | اختيار الدولة والعلم عند أول فتح | `app/welcome.tsx` + `countryGateCompleted` |
| 2 | موجز «جميع الدول» افتراضيًا | `marketCode = ALL` بعد البوابة |
| 3 | مشاهدة إعلانات دول مختلفة | `ads.feed` لا يفلتر بالدولة إلا عند الاختيار الصريح / قريب منك / دولتي |
| 4 | نشر مجاني فوري | `ads.create` + `launch.policy` |
| 5 | ظهور الإعلان من جهاز آخر | **يتطلب** DB + خادم يعمل؛ المسار جاهز عبر `ads.feed` / `ads.create` |
| 6 | فحص AI في الخلفية | `scanAdContent` — نص/روابط/تكرار؛ لا رؤية صور/فيديو بعد |
| 7 | تحكم الإدارة بالمجاني/المدفوع/الخصم | `admin/settings` + `admin/pricing` + كوبونات + إعفاءات |
| 8 | السعر من الخادم | `product.quote` + لقطة `ad_price_snapshots` + firstAdFree / freeAdsPerUser |
| 9 | المدفوعات مجهزة ومتوقفة | adapters + `payment_intents` + sandbox ممنوع في production |
| 10 | لا موافقة بشرية مسبقة | `manualPreApproval = false` افتراضيًا |
| 11 | الإعلانات ليست من AsyncStorage | prefs فقط في `e3lani.prefs.v2`؛ الموجز من `ads.feed` |
| 12 | OTP | `auth.requestOtp` / `verifyOtp` — رمز 123456 في Sandbox فقط ولا يظهر في Production |
| 13 | دورة حياة الإعلان | `ads.update` / `pause` / `publish` / `delete` + واجهة إعلاناتي |
| 14 | إشعارات الخادم | `notifications.*` + إنشاء عند النشر/الإيقاف |
| 15 | دمج الزائر | `visitor.upsert` + دمج عند `verifyOtp` عبر `anonymousId` |
| 16 | دول/مدن | `countries.page` / `cities` / `setActive` + `cities.countryId` (هجرة 0009) |
| 17 | سجل التدقيق | `admin.audit` من `audit_logs` |
| 18 | طابور المراجعة | `moderation.queue` / `decide` |
| 19 | تنظيف وسائط يتيمة | `admin.cleanupOrphanMedia` |

## ما يبقى عليك (بيئة / أجهزة / مزودون)

هذه البنود **متعمدة خارج نطاق الكود** الآن:

1. **اختبار جهازين حقيقيين** مع `DATABASE_URL` + تطبيق الهجرات حتى `0009` + `db:seed` للتأكد أن إعلانًا منشورًا من جهاز يظهر في موجز جهاز آخر.
2. **مفتاح مزود OTP الإنتاجي** (`OTP_PROVIDER_API_KEY`) — غير Sandbox.
3. **مزود دفع حقيقي / sandbox رسمي** وربطه من إعدادات الإدارة (المسارات جاهزة؛ لا تُنشأ مدفوعات بمبلغ صفر).
4. **نموذج مراجعة صور/فيديو** — الدالة `scanMediaWithProvider` موجودة كخطاف وتُرجع `null` حتى تُوصَل بمزوّد.

## إعدادات الإطلاق الافتراضية

- Global Free Mode = ON
- Payments Enabled = OFF
- Payment Required = OFF
- Instant Publishing = ON
- Manual Pre-Approval = OFF
- AI Moderation = ON
- All Countries Visibility = ON
- Default Feed Market = ALL
- First Ad Free = ON (يُطبَّق عند إيقاف المجاني العالمي)

## هجرة مطلوبة

- `drizzle/0009_lifecycle_geo_coupons_audit.sql` — `cities.countryId`، كوبونات/استرداد، إعفاءات، جلسات زائر.
