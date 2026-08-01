# معيار قبول الإطلاق العالمي المفتوح — إعلاني

## الحالة الحالية في هذا الفرع

| # | المعيار | الحالة |
|---|---------|--------|
| 1 | مستخدم سعودي يفتح التطبيق | مدعوم |
| 2 | اختيار السعودية عند التسجيل/الحساب | `accountCountry` منفصل عن فلتر الموجز |
| 3 | ظهور علم الدولة في الحساب | عبر أسواق `MARKETS` + صفحة الحساب |
| 4 | الصفحة الرئيسية تعرض 🌍 جميع الدول | الافتراضي `marketCode = ALL` |
| 5 | مشاهدة إعلانات من دول متعددة | بذور SA/AE/EG + ترتيب عالمي |
| 6 | فلتر الإمارات يعرض إعلانات الإمارات فقط | `forceCountryFilter` |
| 7 | العودة إلى جميع الدول | اختيار 🌍 |
| 8 | نشر مجاني فوري | `FREE_LAUNCH` + `launch.policy` |
| 9 | الظهور من حساب/جهاز آخر | عبر الموجز المحلي/المركزي حسب الربط |
| 10 | فحص ذكاء اصطناعي في الخلفية | `scanAdContent` + علامات SAFE/NEEDS_REVIEW/BLOCKED |
| 11 | الإبلاغ عن مخالفة | مسار البلاغات القائم |
| 12 | الإدارة توقف الإعلان | لوحة الإدارة / `setAdStatus` |
| 13 | تحويل النظام من مجاني إلى مدفوع | مفاتيح `launch.policy` |
| 14 | سعر دولة دون التأثير على غيرها | `scoped_pricing_rules` + `resolvePublishQuote` |
| 15 | خصم مؤقت | حقول `startsAt`/`endsAt` + وضع `discount` |
| 16 | عودة السعر بعد انتهاء العرض | قواعد غير النشطة تُستبعد تلقائيًا |
| 17 | عدم تغيير السجلات السابقة | `ad_price_snapshots` |
| 18 | تشغيل بوابات الدفع لاحقًا من الإعدادات | `paymentsEnabled` + `lib/payments/providers.ts` + `product.updateLaunchPolicy` |

## إعدادات الإطلاق الافتراضية

- Global Free Mode = ON
- Payments Enabled = OFF
- Payment Required = OFF
- All Countries Visibility = ON
- Instant Publishing = ON
- AI Moderation = ON
- Manual Pre-Approval = OFF
- Post-Publish Reports = ON
