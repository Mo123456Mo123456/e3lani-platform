# API والوقت الحقيقي

Swagger متاح عند `/docs`، والمستند الخام عند `/openapi.json`.

## المسارات

| Method | Path | Auth | الوظيفة |
|---|---|---|---|
| GET | `/health` | — | صحة الخدمة ونوع المستودع |
| POST | `/v1/auth/register` | — | حساب بكلمة مرور scrypt |
| POST | `/v1/auth/login` | — | Access JWT وRefresh cookie |
| POST | `/v1/auth/refresh` | Cookie + Origin | تدوير refresh token |
| GET | `/v1/world/overview` | — | إسقاط العالم الحالي |
| GET | `/v1/simulation/snapshots/:tick` | — | لقطة تاريخية |
| POST | `/v1/contributions/analyze` | Bearer | فحص وStructured Output |
| POST | `/v1/contributions/scenarios` | Bearer | Monte Carlo |
| POST | `/v1/contributions` | Bearer | حفظ مساهمة بإصدار متوقع |
| POST | `/v1/simulation/tick` | Bearer | تشغيل دورة |
| POST | `/v1/simulation/pause` | simulation admin | إيقاف/استئناف |
| POST | `/v1/simulation/rollback` | simulation admin | استعادة Snapshot |

## WebSocket

الاتصال:

```text
ws://localhost:4000/ws?token=<short-lived-access-token>
```

رسالة Delta:

```json
{
  "type": "WORLD_DELTA",
  "planetId": "uuid",
  "version": 74,
  "events": [],
  "changedRegionIds": ["uuid"]
}
```

لا ترسل القناة state كاملًا. عند Delta يبطل العميل query الإسقاط ويعيد تحميل البيانات القابلة للعرض. في الإنتاج يفضل تمرير JWT كبروتوكول WebSocket قصير العمر بدل query string إذا كانت طبقة proxy تسجل URLs.

## NATS

ينشر API:

- `world.delta`
- `world.event.<lowercase_event_type>`

يشترك عامل الإشعارات في queue group `notifications`. ويمنع إدراج إشعار الحدث نفسه مرتين باستخدام `where not exists`.

## الأخطاء

- `400 VALIDATION_ERROR`: Zod/Pydantic رفض البنية.
- `400 PROMPT_INJECTION_DETECTED`: إشارة حقن معروفة.
- `401`: توكن غائب/تالف.
- `403 INSUFFICIENT_ROLE`: RBAC.
- `409 WORLD_VERSION_CONFLICT`: تغير العالم بعد المعاينة.
- `404 SNAPSHOT_NOT_FOUND`: لا توجد لقطة محفوظة للدورة.
