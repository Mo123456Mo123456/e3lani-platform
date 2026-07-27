# مصفوفة الاختبار حسب السطح — إعلاني | E3lani

**التاريخ:** 27 يوليو 2026  
**الفرع:** `cursor/phase-1-foundation-b0e4`  
**PR:** #2 (Draft)

## الملخص السريع

| السطح | الحالة |
|---|---|
| Web tested | ✅ نعم |
| Expo Web tested | ✅ نعم |
| Android native tested | ⚠️ APK مبني وقابل للتثبيت — **لم يُختبر على جهاز/محاكي فعلي في هذه البيئة (لا KVM / لا جهاز)** |
| iOS native tested | ❌ لم يتم — لا macOS / لا Xcode / لا Simulator في بيئة الوكيل |
| Production integrations not configured | ✅ مؤكد — Sandbox فقط |

---

## 1) Web tested ✅

- Playwright E2E + Visual QA على Desktop / iPhone viewport / Pixel viewport
- مسار كامل: OTP → إنشاء → فيديو → مراجعة → دفع 59 → Webhook → Feed
- RTL عربي + EN/LTR
- Console/API audit نظيف أثناء المسار
- Preview عبر Cloudflare Tunnel (مؤقت طالما جلسة الوكيل تعمل):
  - Web: https://regulations-computer-fact-tribes.trycloudflare.com
  - Admin: https://spencer-var-inns-strictly.trycloudflare.com
  - API: https://guru-beverly-basename-toilet.trycloudflare.com

## 2) Expo Web tested ✅

- Expo Web على `:8081` + لقطات `expo-*-home.png`
- يستخدم نفس `@e3lani/api-client` ومسارات الجوال

## 3) Android native — APK built, device test blocked ⚠️

**ما تم:**
- `eas.json` جاهز لـ preview/internal APK
- `npx eas-cli whoami` → **Not logged in** (لا `EXPO_TOKEN` / لا حساب EAS في البيئة)
- بديل منفّذ: Expo prebuild + Gradle `assembleDebug`
- APK منشور:
  - https://github.com/Mo123456Mo123456/e3lani-platform/releases/download/visual-qa-phase3/e3lani-debug.apk
- صلاحيات Android مضبوطة في `app.json` (كاميرا / وسائط / تخزين)
- `react-native.config.js` لإصلاح autolinking في monorepo pnpm

**ما لم يتم في هذه الـVM:**
- لا `/dev/kvm` → لا Android Emulator عملي
- لا جهاز USB فعلي
- لذلك بنود الاختبار التالية **لم تُنفَّذ على native**:
  - OTP على جهاز
  - اختيار صورة/فيديو من المعرض
  - صلاحيات وقت التشغيل
  - رفع فيديو من الجهاز
  - تشغيل Feed محليًا
  - التنقل السفلي / الرجوع / لوحة المفاتيح / الأداء

**مطلوب منك محليًا:** تثبيت الـAPK ومراجعة البنود أعلاه على جهاز Android.

لإعادة البناء لاحقًا عبر EAS (عند توفر حساب):

```bash
cd apps/mobile
eas login
eas build -p android --profile preview
```

## 4) iOS native tested ❌

- بيئة Linux فقط — لا Xcode ولا iOS Simulator
- `bundleIdentifier`: `sa.e3lani.app` مضبوط في `app.json`
- أذونات الكاميرا/المعرض مضافة في `infoPlist`
- **اختبار iOS الأصلي لم يتم**

على Mac:

```bash
cd apps/mobile
npx expo prebuild --platform ios
# ثم Xcode / Simulator أو:
eas build -p ios --profile preview
```

## 5) Production integrations not configured ✅

غير مفعّل للإنتاج:
- مزود OTP حقيقي
- Moyasar / MyFatoorah / StoreKit / Google Play Billing
- Secret Manager / MFA إدارة
- نطاقات إنتاج / CDN

الوضع الحالي: **Sandbox فقط** (OTP `123456`، دفع sandbox، Webhook موقّع).

## روابط الأدلة

- الصور داخل المستودع: `docs/visual-evidence/`
- التسجيل + APK: https://github.com/Mo123456Mo123456/e3lani-platform/releases/tag/visual-qa-phase3
