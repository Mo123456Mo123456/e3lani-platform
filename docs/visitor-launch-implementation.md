# تنفيذ الإطلاق المفتوح للزوار

## النطاق المنفذ

- الدخول والتصفح والبحث والحفظ والمشاركة والتواصل دون تسجيل إجباري.
- هوية زائر عشوائية موقعة بـHMAC، محفوظة في SecureStore على الهاتف، مع تحقق خادمي من الحالة وإصدار الرمز.
- ملكية خادمية للوسائط والإعلانات والمنشورات والمحفوظات والتفضيلات والبلاغات.
- نقل ذري لبيانات الزائر إلى الحساب بعد نجاح OTP، ويشمل الإعلانات والمنشورات والوسائط والمحـفوظات والمتابعات والبلاغات وطلبات المشاركة.
- نشر الإعلانات فور حفظها في MySQL في الوضع المجاني الافتراضي.
- حد متحرك خلال 24 ساعة: 10 إعلانات و30 منشورًا افتراضيًا، مع قفل سجل الهوية لمنع تجاوز الحد بالطلبات المتزامنة.
- مفاتيح Idempotency إلزامية لإنشاء الإعلان والمنشور والبلاغ ونسخة الفيديو.
- منشورات مستقلة في `profile_posts` لا تدخل استعلام الموجز العام.
- صفحة معلن عامة باسم مستخدم فريد، غلاف وصورة ونبذة وروابط اجتماعية وإحصاءات وتبويبين.
- تحويل المنشور إلى نموذج إعلان مع نسخ النص والوسائط، مع بقاء المنشور الأصلي.
- فحص نصي، وفحص صور/فيديو عبر مزود اختياري، وبلاغات منظمة وطابور مراجعة وسجل تدقيق.
- صفحة Open Graph عامة وصورة مشاركة 1200×630 لكل إعلان نشط.
- نسخة MP4 مستقلة 9:16 بعلامة مائية متحركة، دون تعديل الملف الأصلي، وتنتهي صلاحية الوصول إليها بعد 7 أيام.

## الإعدادات الافتراضية

توجد في `launch.policy` وتُدار من لوحة الإدارة:

- `authenticationRequired = false`
- `guestPublishingEnabled = true`
- `phoneVerificationEnabled = false`
- `emailVerificationEnabled = false`
- `verificationRequiredForPublishing = false`
- `brandVerificationEnabled = false`
- `instantPublishing = true`
- `manualPreApproval = false`
- `moderationMode = post_publish`
- `globalFreeMode = true`
- `paymentRequired = false`
- `mainAdsDailyLimit = 10`
- `profilePostsDailyLimit = 30`
- `reportDailyLimit = 20`
- `watermarkEnabled = true`
- `watermarkText = إعلاني | E3lani`
- `postToAdEnabled = true`

## الترحيل

`drizzle/0010_guest_profiles_posts_sharing.sql` ترحيل إضافي لا يحذف بيانات سابقة. يضيف:

- ملكية الزائر إلى الإعلانات والمراجعات والوسائط والمحفوظات.
- `advertiser_profiles`
- `profile_posts`
- `profile_post_media`
- `profile_follows`
- `identity_action_events`
- `share_media_variants`
- ملكية الزائر للبلاغات وسجل التدقيق.
- ربط حالات المراجعة بمنشورات الصفحة.
- إنشاء صفحات معلنين ووقائع نشر للإعلانات الموجودة قبل الترحيل.

يجب أخذ نسخة احتياطية وتشغيل الترحيل أولًا في Staging ثم تنفيذ اختبارات النشر والدمج.

## واجهات الخادم المضافة أو الموسعة

- `visitor.ensure`, `visitor.upsert`
- `advertisers.get`, `advertisers.mine`, `advertisers.update`, `advertisers.toggleFollow`
- `profilePosts.get`, `list`, `mine`, `create`, `update`, `delete`, `conversionDraft`, `recordEvent`, `report`
- `ads.create`, `mine`, `update`, `pause`, `publish`, `delete`, `toggleSave`, `saved`, `report` تعمل للحساب أو الزائر الموقّع.
- `sharing.createVideoVariant`, `sharing.retryVideoVariant`
- `admin.reports`, `admin.decideReport`, `admin.setIdentitySuspension`
- `GET /share/ad/:id`
- `GET /share/ad/:id/card.png`
- `GET /share/media/:id`

## متطلبات البيئة الخارجية

إلزامي في الإنتاج:

- `DATABASE_URL`: اتصال MySQL.
- `VITE_APP_ID` و`JWT_SECRET`: الجلسات وتوقيع هوية الزائر.
- `BUILT_IN_FORGE_API_URL` و`BUILT_IN_FORGE_API_KEY`: روابط رفع وتنزيل الوسائط الموقعة.
- `PUBLIC_APP_URL`: الأصل العام المستخدم في الروابط وOpen Graph.
- وجود `ffmpeg` و`ffprobe` وخط DejaVu Sans داخل صورة الخادم.
- سياسة lifecycle في تخزين الوسائط لحذف `media/share/` بعد مدة الاحتفاظ؛ الخادم يمنع الوصول بعد انتهاء السجل حتى قبل حذف الكائن.

اختياري ولا يُفعّل تلقائيًا:

- `MODERATION_PROVIDER_URL` و`MODERATION_PROVIDER_API_KEY`: مزود حقيقي لفحص الصور والفيديو. عند غيابه يستمر فحص النص والبلاغات، ولا يسجل الخادم نجاح فحص وسائط غير منفذ.
- `OTP_PROVIDER`, `OTP_PROVIDER_URL`, `OTP_PROVIDER_API_KEY` وبقية إعدادات مزود OTP عند إعادة تفعيل التحقق من لوحة الإدارة.
- إعدادات Twilio موجودة كموصل فقط ولم تُفعّل.

الدفع يبقى معطلًا ولا يحتاج مفاتيح في وضع الإطلاق الحالي.

## التحقق الآلي

- `pnpm check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm build:web`

يتضمن الاختبار الفعلي للفيديو إنشاء ملف MP4، وتوليد نسخة بعلامة مائية، والتحقق عبر `ffprobe` من أبعاد 1080×1920 ومن عدم تغير بصمة الأصل.

