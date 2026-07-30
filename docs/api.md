# API وWebSocket

واجهة Swagger التفاعلية متاحة عند `http://localhost:4000/docs`.

## REST

| Method | Path | Auth | الغرض |
|---|---|---|---|
| GET | `/health` | public | قاعدة البيانات والمحرك |
| GET | `/metrics` | network policy | Prometheus |
| POST | `/v1/auth/register` | public | حساب + role user |
| POST | `/v1/auth/login` | public | access token + refresh cookie |
| POST | `/v1/auth/refresh` | strict cookie | rotation |
| POST | `/v1/auth/logout` | strict cookie | revoke |
| GET | `/v1/planets/:id/bootstrap` | public | planet + regions + events + metrics |
| POST | `/v1/contributions/analyze` | Bearer | moderation + provider analysis |
| POST | `/v1/contributions/preview` | Bearer | Monte Carlo، بلا كتابة |
| POST | `/v1/contributions` | Bearer | كتابة idempotent وتغيير العالم |
| GET | `/v1/contributions/:id/causes` | public | الأحداث والروابط السببية |
| GET | `/v1/planets/:id/compare?from=&to=` | public | مقارنة checksums لـsnapshots |
| POST | `/v1/admin/planets/:id/tick` | simulation_manager | Tick واحد |
| POST | `/v1/admin/planets/:id/rollback/:tick` | simulation_manager | rollback مدمر للفرع اللاحق |
| GET | `/v1/admin/overview` | admin | مؤشرات فعلية |

استخدم `IdempotencyKey` UUID داخل جسم تأكيد المساهمة. إعادة الطلب نفسه تعيد الحدث الموجود ولا تكرر التغيير.

## WebSocket delta protocol

الاتصال الافتراضي: `ws://localhost:4100/ws`.

```json
{
  "sequence": 42,
  "planetId": "00000000-0000-4000-8000-000000000001",
  "tick": 129,
  "kind": "event.created",
  "payload": {
    "id": "evt-...",
    "type": "CLIMATE_CHANGED",
    "regionId": "region-0042"
  }
}
```

القيم المتاحة لـ`kind`:

- `event.created`
- `region.updated`
- `simulation.status`
- `notification.created`

البوابة لا ترسل الحالة الكاملة. عند فقد sequence أو إعادة الاتصال يطلب العميل bootstrap من REST، ثم يتابع deltas.

## الأخطاء

الأخطاء لا تُعرض كنجاح. مثال غياب AI:

```json
{
  "error": "AI_PROVIDER_UNAVAILABLE",
  "message": "AI analysis failed",
  "fallbackUsed": false
}
```

تتضمن أخطاء الخادم العامة `requestId` للربط بالسجلات، ولا تُرجع stack أو سرًا.
