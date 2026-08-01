# معيار قبول الإطلاق العالمي — تحديث الفرع

## ما هو مكتمل في الكود

| # | المعيار | الحالة |
|---|---------|--------|
| 1 | اختيار الدولة والعلم عند أول فتح | `app/welcome.tsx` + `countryGateCompleted` |
| 2 | موجز «جميع الدول» افتراضيًا | `marketCode = ALL` بعد البوابة |
| 3 | مشاهدة إعلانات دول مختلفة | `ads.feed` لا يفلتر بالدولة إلا عند الاختيار الصريح / قريب منك / دولتي |
| 4 | نشر مجاني فوري | `ads.create` + `launch.policy` |
| 5 | ظهور الإعلان من جهاز آخر | **يتطلب** DB + خادم يعمل؛ المسار جاهز عبر `ads.feed` / `ads.create` |
| 6 | فحص AI في الخلفية | `scanAdContent` — لا يوقف بكلمة منفردة بلا سياق |
| 7 | تحكم الإدارة بالمجاني/المدفوع/الخصم | `admin/settings` + `admin/pricing` + `updateLaunchPolicy` / `upsertPricingRule` |
| 8 | السعر من الخادم | `product.quote` + لقطة `ad_price_snapshots` |
| 9 | المدفوعات مجهزة ومتوقفة | adapters + `payment_intents` + sandbox ممنوع في production |
| 10 | لا موافقة بشرية مسبقة | `manualPreApproval = false` افتراضيًا |
| 11 | الإعلانات ليست من AsyncStorage | prefs فقط في `e3lani.prefs.v2`؛ الموجز من `ads.feed` |
| 12 | OTP | `auth.requestOtp` / `verifyOtp` — رمز 123456 في Sandbox فقط ولا يظهر في Production |

## ما يبقى Sandbox / يحتاج بيئة

- ظهور إعلان بين جهازين حقيقيين يحتاج `DATABASE_URL` + تطبيق الهجرات `0005`/`0006` + `db:seed`.
- OTP الإنتاجي يحتاج `OTP_PROVIDER_API_KEY` (وإلا `OTP_PROVIDER_NOT_CONFIGURED`).
- الدفع الإنتاجي يبقى متوقفًا حتى تفعيل المزود من الإعدادات.

## إعدادات الإطلاق الافتراضية

- Global Free Mode = ON
- Payments Enabled = OFF
- Payment Required = OFF
- Instant Publishing = ON
- Manual Pre-Approval = OFF
- AI Moderation = ON
- All Countries Visibility = ON
- Default Feed Market = ALL
