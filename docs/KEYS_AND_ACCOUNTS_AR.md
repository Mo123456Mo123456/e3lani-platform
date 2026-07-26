# المفاتيح والحسابات — إعلاني | E3lani

> لا تُحفظ أسرار حقيقية داخل المستودع. استخدم Secret Manager في الإنتاج.

| الخدمة | الغرض | متغيرات أساسية | ملاحظات |
|---|---|---|---|
| PostgreSQL | قاعدة البيانات | `DATABASE_URL` | إلزامي |
| Redis | جلسات/طوابير | `REDIS_URL` | إلزامي للطوابير |
| JWT | مصادقة | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | تدوير عند التسريب |
| OTP | تسجيل الدخول | `OTP_MODE`, `OTP_PROVIDER`, مفاتيح Unifonic/Twilio/SNS | Production يفشل بدون مفاتيح |
| Object Storage | وسائط | `S3_ENDPOINT`, `S3_BUCKET`, مفاتيح الوصول | S3-compatible |
| Moyasar | دفع سعودي | `MOYASAR_SECRET_KEY` | Hosted Checkout |
| HyperPay | دفع إقليمي | `HYPERPAY_ACCESS_TOKEN` | |
| MyFatoorah | دفع خليجي | `MYFATOORAH_API_KEY` | |
| Tap | دفع إقليمي | `TAP_SECRET_KEY` | |
| PayTabs | دفع إقليمي | `PAYTABS_PROFILE_ID` | |
| Stripe | دولي | `STRIPE_SECRET_KEY` | حسب الأهلية |
| PayPal | ويب | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Business مؤهل |
| Apple IAP | iOS | `APPLE_ISSUER_ID`, مفاتيح App Store Server API | تحقق خادمي |
| Google Play | Android | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | RTDN + acknowledgement |
| Moderation AI | مساعدة مراجعة | `MODERATION_PROVIDER` | اختياري؛ قواعد محلية عند الغياب |

## Sandbox مقابل Production

- `PAYMENT_MODE=sandbox` و `OTP_MODE=sandbox` للتطوير المحلي فقط.
- Sandbox OTP المعلن: `123456`.
- Production: Fail Closed — لا Mock نجاح عند نقص المفاتيح.
- Webhooks تتطلب تحقق التوقيع وIdempotency عبر `eventId` فريد.
