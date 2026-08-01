# الروابط العميقة — فتح الإعلانات داخل التطبيق

الهدف: من يفتح رابط إعلان مشارَك (`https://e3lani.sa/ad/abc123`) ولديه التطبيق
يُفتح داخله مباشرة على الإعلان نفسه، لا في المتصفح.

## ما هو منفَّذ بالفعل

| الجزء | الحالة |
|---|---|
| مخطط التطبيق `e3lani://` | مضبوط في `app.json` |
| ربط مسارات Expo Router (`/ad/:id`, `/u/:id`) | تلقائي — بنية المجلدات هي الخريطة |
| `associatedDomains` لـ iOS | مضبوط لـ `e3lani.sa` و `www.e3lani.sa` |
| `intentFilters` لأندرويد مع `autoVerify` | مضبوط لمسارَي `/ad` و `/u` |
| ملف `apple-app-site-association` | موجود في `apps/web/public/.well-known/` |
| ملف `assetlinks.json` | موجود في `apps/web/public/.well-known/` |
| ترويسات JSON الصحيحة للملفين | مضبوطة في `next.config.mjs` |

## ما يجب إكماله قبل الإطلاق

الملفان يحتويان على قيمتين لا يمكن معرفتهما إلا بعد إنشاء حساب المطوّر:

### ١) معرّف فريق آبل

في `apps/web/public/.well-known/apple-app-site-association` استبدل `TEAMID`:

```json
"appIDs": ["ABCD123456.sa.e3lani.app"]
```

تجده في: Apple Developer ← Membership ← Team ID.

### ٢) بصمة شهادة توقيع أندرويد

في `apps/web/public/.well-known/assetlinks.json` ضع بصمة SHA-256:

```bash
cd apps/mobile
eas credentials --platform android
# انسخ قيمة SHA-256 Fingerprint
```

## التحقق بعد النشر

```bash
# يجب أن يعيد JSON بترويسة application/json وبلا تحويل
curl -sI https://e3lani.sa/.well-known/apple-app-site-association | head -3
curl -s  https://e3lani.sa/.well-known/assetlinks.json
```

أدوات رسمية للفحص:
- آبل: https://search.developer.apple.com/appsearch-validation-tool
- أندرويد: `adb shell pm verify-app-links --re-verify sa.e3lani.app`

## اختبار محلي

```bash
# iOS Simulator
xcrun simctl openurl booted "e3lani://ad/ADVERT_ID"

# Android
adb shell am start -a android.intent.action.VIEW -d "e3lani://ad/ADVERT_ID"
```

> ملاحظة: الروابط العالمية (https) لا تعمل إلا بعد رفع التطبيق للمتجر ونشر الملفين
> على النطاق الحقيقي. مخطط `e3lani://` يعمل فورًا في التطوير.
