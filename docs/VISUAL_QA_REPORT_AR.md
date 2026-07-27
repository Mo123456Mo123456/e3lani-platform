# تقرير التدقيق والتجربة المرئية — إعلاني | E3lani

**الفرع:** `cursor/phase-1-foundation-b0e4`  
**PR:** #2 (Draft)  
**التاريخ:** 27 يوليو 2026

## 1) تشغيل المنظومة معًا

| مكوّن | الحالة |
|---|---|
| PostgreSQL / Redis / MinIO | يعمل (Docker) |
| API `:3001` | يعمل |
| Media Worker | يعمل |
| Web `:3000` | يعمل |
| Admin `:3002` | يعمل |
| Expo Web `:8081` | يعمل |

> ملاحظة البيئة: لا يوجد Android Emulator فعلي في هذه الـVM. تم الاختبار عبر Playwright (Pixel 7 + iPhone 14) + Expo Web + سطح المكتب.

## 2) تسجيل الشاشة للمسار الكامل

- `/opt/cursor/artifacts/visual-qa/full-flow-recording.mp4`
- `/opt/cursor/artifacts/visual-qa/full-flow-recording.webm`
- `/opt/cursor/artifacts/full-flow-recording.webm`

المسار المسجّل: OTP → حساب → إنشاء → رفع فيديو → معالجة → مراجعة → قبول → دفع 59 → Webhook → تفعيل → Feed.

## 3) صور الشاشات الرئيسية

المجلد: `/opt/cursor/artifacts/visual-qa/`

| الشاشة | ملف |
|---|---|
| الرئيسية | `desktop-01-home.png` |
| الإنجليزية LTR | `desktop-01b-home-en-ltr.png` |
| الأقسام | `desktop-02-categories.png` |
| إضافة إعلان | `desktop-05-create.png` |
| رفع الفيديو | `desktop-06-upload-video.png` |
| حالة الإعلان | `desktop-07-ad-status-pending.png` |
| الدفع | `desktop-10-payment.png` |
| الحساب | `desktop-04-account.png` |
| المحفوظات | `desktop-15-saved.png` |
| صفحة الإعلان | `desktop-12-ad-page.png` |
| صفحة البراند | `desktop-13-brand.png` |
| لوحة المراجعة | `desktop-08-admin-review.png` |
| المدفوعات | `desktop-09-admin-payments.png` |
| Feed | `desktop-14-feed.png` |
| iPhone / Android / Expo | `iphone-*`, `android-*`, `expo-*` |

## 4) تدقيق بصري

- RTL عربي: `dir=rtl` + خط عربي
- الإنجليزية LTR: زر `EN/ع` يبدّل `dir` والنصوص الأساسية
- ألوان الهوية: `#FFC400` / `#111111` / `#F7F7F7`
- الاسم: `إعلاني | E3lani`
- الشعار/الوصف: `منصة الإعلانات المرئية لكل شيء`
- زر إضافة إعلان أصفر مركزي في الويب والجوال
- إخفاء أدوات ثانوية أثناء المشاهدة (Feed + صفحة الإعلان + Feed الجوال)
- Responsive: Desktop / iPhone 14 / Pixel 7 / Expo Web

## 5) فحوصات الجودة

- لا Mock في المسارات الأساسية
- لا أسرار حقيقية داخل المستودع (فقط `.env.example`)
- Console audit: بدون أخطاء حرجة / بدون API فاشل (`console-audit.json`)
- فيديو حقيقي من الـfixture يمر عبر FFmpeg ويظهر في Feed

## 6) نتائج الأوامر

| الأمر | النتيجة |
|---|---|
| `pnpm typecheck` | ناجح |
| `pnpm lint` | ناجح |
| `pnpm test` | ناجح |
| `pnpm test:integration` | `PHASE2_INTEGRATION_OK` |
| `pnpm test:e2e` | ناجح (6/6) |
| `pnpm build` | ناجح |

## 7) حالة PR / Issue

- PR يبقى **Draft** لمراجعة التسجيل والصور
- Issue #1 **لا يُغلق** حتى اعتمادك البصري للمسار

---

## تحديث قابلية المراجعة (نفس الجلسة)

- الصور المضغوطة داخل المستودع: [`docs/visual-evidence/`](./visual-evidence/)
- تسجيل المسار + APK على GitHub Release: https://github.com/Mo123456Mo123456/e3lani-platform/releases/tag/visual-qa-phase3
- مصفوفة الأسطح: [`docs/DEVICE_TEST_MATRIX_AR.md`](./DEVICE_TEST_MATRIX_AR.md)
