# مصفوفة التنفيذ

| المجال | الحالة | ملاحظات |
|---|---|---|
| Monorepo / Turborepo | Done | pnpm workspaces |
| Types / Ad state machine | Done | اختبارات وحدة |
| Auth OTP adapter | Partial | Sandbox فقط؛ Production fail-closed |
| Users / Sessions | Partial | JWT + refresh hash؛ دوران كامل لاحقًا |
| Countries / Cities / Categories | Done | Seed SA + 21 قسمًا |
| Ads / Revisions | Partial | إنشاء، إرسال مراجعة، نسخة جديدة تلغي الدفع |
| Media upload / FFmpeg | Scaffold | media-worker فقط |
| Moderation | Scaffold | نموذج بيانات + سياسة |
| Pricing engine | Done | 59/10/29/15/29/29/10 SAR |
| Orders / Idempotency | Partial | إنشاء طلب + خيارات دفع |
| Payment providers | Scaffold | Adapters غير مفعّلة بدون مفاتيح |
| Webhooks | Pending | مخطط جدول الأحداث موجود |
| Mobile Feed UI | Partial | Demo data + RTL shells |
| Web SEO pages | Partial | Home/Browse/Pricing |
| Admin review console | Scaffold | هيكل تنقل |
| Notifications | Pending | نموذج Notification موجود |
| Analytics | Pending | AnalyticsEvent model |
| E2E / Playwright | Pending | |
| Production readiness | No | يحتاج مفاتيح وبنية إنتاج |

## سياسة التعارض

`docs/requirements/PRODUCT_SPEC_AR.md` + برومبت 27 يوليو 2026 يلغيان أسعار README القديمة (19 ر.س).
