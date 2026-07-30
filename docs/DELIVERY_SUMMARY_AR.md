# ملخص التسليم — إعلاني | E3lani

## ما اكتمل

### البنية
- Monorepo Turborepo: `apps/{mobile,web,admin}` + `services/{api,media-worker}` + packages
- TypeScript في كل الطبقات
- PostgreSQL + Prisma + Migrations + Seed
- Redis + BullMQ (media-worker)
- S3-compatible storage (MinIO محليًا / R2 / sandbox)
- JWT + OTP (Adapter Pattern) — Production fail-closed
- Rate limiting + Audit logs
- اختبارات وحدة + سكربت تكامل

### الهوية
- عربي RTL + إنجليزي LTR
- ألوان: `#FFC400` / `#111111` / أبيض / `#F7F7F7`
- شعار «إعلاني» ووسم «منصة الإعلانات المرئية لكل شيء»

### الحسابات
- تسجيل برقم الجوال + OTP فقط
- نوع الحساب: فرد / متجر / براند / شركة
- موافقة الشروط والخصوصية
- صفحات براند عامة مع تبويبي: الإعلانات | المنشورات

### الإعلانات والموجز
- تصفح عمودي: لك / قريب منك / الأحدث
- وسائط: فيديو ≤60ث أو 1–5 صور مع معالجة FFmpeg/sharp
- نشر FREE_LAUNCH مباشر: مسودة → نشط
- لا منشورات مجانية في موجز الإعلانات

### المنشورات المجانية
- جداول وAPI منفصلة (`ProfilePost`)
- تظهر فقط في صفحة صاحب الحساب
- حفظ / مشاركة / CRUD للمالك

### الشريط العلوي
- API `/ticker` — شعارات فقط
- غير قابل للنقر، لا يتوقف، فاصل «إعلاني» بين الشعارات
- حالات: مسودة → بانتظار الدفع → بانتظار المراجعة → مقبول → نشط → مرفوض → منتهي → متوقف

### التسعير والدفع
- كتالوج 59/5/5/10/20/15/5/50 قابل للتعديل من الإدارة
- Payment Provider Adapter (sandbox / Moyasar / MyFatoorah)
- لا نجاح وهمي في الإنتاج

### الإدارة (RBAC)
- Super Admin، مشرف إعلانات، دعم، حملات، مالي، محتوى
- مستخدمون، إعلانات، بلاغات، اعتراضات، أقسام، أسعار، مدفوعات، إشعارات، تدقيق، شعارات الشريط، وضع التشغيل

### التحليلات والإشعارات
- أحداث Analytics + إشعارات للحالات المهمة
- تقارير صاحب الإعلان عبر أحداث الظهور/النقر/الحفظ/المشاركة

### التوصيات الذكية («لك»)
- نظام هجين: Content-Based + Collaborative + Popularity + Location + Recency + Business Rules
- Adapter Pattern (`@e3lani/recommendations`) لربط Embeddings لاحقًا
- تسجيل تفاعلات + مصدر الظهور (Organic / Paid / Smart Recommendation)
- أوزان قابلة للتعديل من `/admin/recommendations`
- Redis cache + فهارس تفاعلات/إحصاءات

## ما يحتاج مفاتيح خارجية قبل الإنتاج

انظر [`KEYS_AND_ACCOUNTS_AR.md`](./KEYS_AND_ACCOUNTS_AR.md).

## حساب Sandbox للإدارة

- الجوال: `+966500000001`
- OTP: `123456` (سجلات الخادم فقط)
