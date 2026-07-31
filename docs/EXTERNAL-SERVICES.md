# الخدمات الخارجية والمفاتيح المطلوبة

هذه قائمة كاملة بكل خدمة خارجية تحتاجها المنصة، وما إذا كانت إلزامية، وكيفية ربطها.

---

## ١) PostgreSQL — إلزامية

قاعدة البيانات الأساسية.

| المتغير | مثال |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/e3lani?schema=public` |

**محليًا:** يوفّرها `pnpm infra:up`.
**في الإنتاج:** أي مزوّد مُدار (Neon، Supabase، RDS، DigitalOcean…). فعّل النسخ الاحتياطي اليومي.
المنصة تنشئ امتداد `pg_trgm` تلقائيًا ضمن الترحيلات لتسريع البحث النصي.

---

## ٢) Redis — إلزامية

تُستخدم للطوابير (BullMQ)، والحد من المعدل، وكاش الكتالوج، وفترة تهدئة إرسال رمز التحقق.

| المتغير | مثال |
|---|---|
| `REDIS_URL` | `redis://default:pass@host:6379` |

**في الإنتاج:** Upstash أو ElastiCache أو Redis Cloud. يجب أن يدعم `INCR` و`EXPIRE` (كلها قياسية).

---

## ٣) تخزين متوافق مع S3 — إلزامية

لتخزين الصور والفيديو والنسخ المشتقة.

| المتغير | الوصف |
|---|---|
| `S3_ENDPOINT` | نقطة النهاية (اتركها فارغة لـ AWS S3 القياسي) |
| `S3_REGION` | المنطقة |
| `S3_BUCKET` | اسم الحاوية |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | مفاتيح الوصول |
| `S3_FORCE_PATH_STYLE` | `true` مع MinIO، `false` مع S3 |
| `S3_PUBLIC_URL` | الرابط العام للقراءة (يفضَّل CDN) |

**خطوات الربط:**
1. أنشئ حاوية باسم `e3lani-media`.
2. اجعل صلاحية القراءة عامة (`GetObject`) والكتابة عبر المفاتيح فقط.
3. اضبط CORS للسماح بـ `PUT` من نطاقات الموقع والتطبيق:
   ```json
   [{ "AllowedOrigins": ["https://e3lani.sa", "http://localhost:3000"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000 }]
   ```
4. ضع CDN أمام الحاوية واستخدم رابطه في `S3_PUBLIC_URL`.

**بدائل مجرّبة:** Cloudflare R2 (بدون رسوم خروج)، AWS S3، DigitalOcean Spaces، MinIO ذاتي الاستضافة.

---

## ٤) مزوّد رسائل التحقق (OTP) — إلزامية في الإنتاج

التسجيل يتم برقم الجوال + رمز تحقق فقط. المزوّد يُبدَّل بمتغيّر بيئة واحد
(`OTP_PROVIDER`) دون تعديل أي منطق أعمال — راجع `services/api/src/modules/auth/providers/`.

| القيمة | المزوّد | المفاتيح المطلوبة |
|---|---|---|
| `console` | التطوير فقط — يطبع الرمز في السجل | لا شيء (ممنوع في الإنتاج) |
| `taqnyat` | [تقنيات](https://taqnyat.sa) | `TAQNYAT_API_KEY`, `TAQNYAT_SENDER` |
| `unifonic` | [يونيفونك](https://unifonic.com) | `UNIFONIC_APP_SID`, `UNIFONIC_SENDER_ID` |
| `msegat` | [مسجات](https://msegat.com) | `MSEGAT_USERNAME`, `MSEGAT_API_KEY`, `MSEGAT_SENDER` |

**خطوات الربط:** أنشئ حسابًا لدى المزوّد ← اعتمد اسم المُرسِل (Sender ID) لدى هيئة الاتصالات ←
انسخ المفاتيح إلى `.env` ← غيّر `OTP_PROVIDER`.

**لإضافة مزوّد جديد:** أنشئ ملفًا ينفّذ واجهة `OtpProvider` وسجّله في `otp.factory.ts` — لا شيء آخر.

---

## ٥) بوابة الدفع — مطلوبة عند تفعيل الدفع فقط

النشر مجاني حاليًا، ونظام الدفع جاهز بالكامل بانتظار التفعيل من لوحة الإدارة
(`PAYMENTS_ENABLED` و`PUBLISHING_MODE`).

| القيمة | البوابة | المفاتيح |
|---|---|---|
| `sandbox` | تجريبي للتطوير فقط (يرفض العمل في الإنتاج) | لا شيء |
| `moyasar` | [ميسر](https://moyasar.com) — مدى وApple Pay والبطاقات | `MOYASAR_SECRET_KEY`, `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET` |
| `tap` | [تاب](https://tap.company) | `TAP_SECRET_KEY`, `TAP_WEBHOOK_SECRET` |
| `hyperpay` | [هايبر باي](https://hyperpay.com) | `HYPERPAY_ENTITY_ID`, `HYPERPAY_ACCESS_TOKEN` |

**خطوات الربط:**
1. أنشئ حساب تاجر واستكمل التحقق (سجل تجاري + آيبان).
2. انسخ المفاتيح إلى `.env` وحدّد `PAYMENT_PROVIDER`.
3. اضبط عنوان الـ Webhook لدى البوابة على:
   `https://api.e3lani.sa/api/payments/webhook`
4. من لوحة الإدارة ← الإعدادات: فعّل «تفعيل الدفع» وغيّر «وضع النشر» إلى `PAID`.

الـ API يتحقق من توقيع الـ Webhook ومن تطابق المبلغ قبل اعتماد أي عملية،
ولا يفعّل أي إعلان أو خدمة ترويج قبل وصول تأكيد الدفع من البوابة.

**لإضافة بوابة جديدة:** نفّذ واجهة `PaymentProvider` وسجّلها في `payment.factory.ts`.

---

## ٦) الإشعارات الفورية — اختيارية

| المتغير | الوصف |
|---|---|
| `PUSH_PROVIDER` | `expo` (افتراضي) أو `fcm` أو `none` |
| `EXPO_ACCESS_TOKEN` | مطلوب فقط للإرسال بحصص أعلى |

إشعارات داخل التطبيق تعمل دائمًا وتُخزَّن في قاعدة البيانات؛ الدفع الخارجي إضافة فوقها.

---

## ٧) ما لا تحتاجه المنصة

لا تعتمد المنصة على أي خدمة خرائط مدفوعة، ولا بوابة شحن، ولا مزوّد دفع للمستخدمين النهائيين،
ولا خدمة محادثات — لأن هذه الميزات خارج نطاق المنتج عمدًا.

---

## ملخص سريع لملء `.env` قبل الإطلاق

```bash
openssl rand -base64 48   # لكل من JWT_ACCESS_SECRET و JWT_REFRESH_SECRET و ADMIN_JWT_SECRET
```

- [ ] `DATABASE_URL`
- [ ] `REDIS_URL`
- [ ] `S3_*` + CORS + CDN
- [ ] `OTP_PROVIDER` ≠ `console` + مفاتيح المزوّد
- [ ] أسرار JWT الثلاثة عشوائية
- [ ] `SEED_SUPER_ADMIN_EMAIL/PASSWORD` قيم حقيقية، و`SEED_DEMO_DATA=false`
- [ ] `CORS_ORIGINS` بنطاقات الإنتاج فقط
- [ ] (لاحقًا) مفاتيح بوابة الدفع + Webhook
