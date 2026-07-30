# HTTP وRealtime

المسار الأساسي: `/api/v1`. التوثيق الحي: `/api/docs`.

اتصال API بخدمة AI داخلي فقط ويجب أن يحمل
`Authorization: Bearer $AI_ORCHESTRATOR_TOKEN`. يربط Docker منفذ الخدمة على
`127.0.0.1` في التطوير ولا يعرّض مفاتيح المزوّد مباشرة للواجهة.

## المصادقة

| Method | Path | Auth | الوصف |
|---|---|---|---|
| POST | `/auth/register` | عام | إنشاء مستخدم وإرجاع access/refresh tokens |
| POST | `/auth/login` | عام | دخول بالبريد وكلمة المرور |
| POST | `/auth/refresh` | refresh token | تدوير refresh token وإصدار جلسة جديدة |
| POST | `/auth/me` | Bearer | قراءة claims الحالية |

كلمة المرور 12–128 حرفًا. Access token افتراضيًا 15 دقيقة، وRefresh token 30 يومًا. لا تحفظ الواجهة access token في `localStorage`؛ تستخدم ذاكرة الجلسة الحالية.

## العالم

| Method | Path | Auth | الوصف |
|---|---|---|---|
| GET | `/world` | عام | Snapshot الحالي مع المناطق والحضارات وآخر الأحداث |
| GET | `/world/regions/:id` | عام | المنطقة والحضارة والمساهمات والأحداث المحلية |
| GET | `/world/events?limit=50&before=120` | عام | سجل أحداث cursor-based |

## المساهمات

| Method | Path | Auth | الوصف |
|---|---|---|---|
| POST | `/contributions/analyze` | عام | Structured Output + moderation + balance |
| POST | `/contributions/preview` | عام | Monte Carlo من دون تعديل العالم |
| POST | `/contributions/confirm` | Bearer | حفظ المساهمة وتشغيل Tick وبث Delta |

مثال:

```json
{
  "category": "plant",
  "text": "شجرة عملاقة تمتص التلوث وتضيء في الليل",
  "locale": "ar",
  "regionId": "region_0042",
  "simulationRuns": 64
}
```

`confirm` لا يعيد نجاحًا قبل حفظ المساهمة والأحداث وSnapshot وSimulationTick في معاملة واحدة.

## الإدارة

| Method | Path | Roles | الوصف |
|---|---|---|---|
| GET | `/system/admin/stats` | system/simulation/super admin | إحصاءات قاعدة البيانات والتكلفة |
| POST | `/simulation/tick` | simulation/system/super admin | تشغيل سنة أو عشر سنوات |
| GET | `/system/health` | عام | اتصال قاعدة البيانات وجاهزية المحاكاة |

## Socket.IO

- Namespace: `/world`
- Transport: `websocket`
- Origin: `WEB_ORIGIN` allowlist
- `handshake.auth.token`: اختياري للقراءة، وإلزامي مستقبلًا لأحداث المستخدم الخاصة.

الاشتراك:

```json
event: "world.subscribe"
payload: { "planetId": "primary-world" }
```

التحديث:

```json
event: "world.delta"
payload: {
  "sequence": 18,
  "tick": 1,
  "changedRegions": [
    {
      "id": "region_0042",
      "vegetation": 0.61,
      "water": 0.52,
      "pollution": 0.09
    }
  ],
  "events": []
}
```

لا ترسل البوابة Snapshot كاملًا بعد كل Tick. إذا انقطع التسلسل، يجب على العميل إعادة `GET /world` بدل تخمين الحالة.

## أخطاء متوقعة

- `DATABASE_URL is required`: لا يوجد fallback إنتاجي.
- `AI_PROVIDER_NOT_CONFIGURED`: لم يحدد مزود حقيقي أو Sandbox معلن.
- `AI_ORCHESTRATOR_UNAVAILABLE`: لم يعد المزود Structured Output صالحًا.
- `CONTRIBUTION_REJECTED_BY_MODERATION`: فشل فحص المحتوى/الحقن.
- `INCOMPATIBLE_START_REGION`: المنطقة لا تناسب الفئة.
- `ROLE_NOT_ALLOWED`: محاولة تنفيذ إجراء إداري من دور عادي.
