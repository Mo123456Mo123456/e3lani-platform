# API وRealtime

OpenAPI التفاعلي متاح على `/docs`. جميع مسارات العالم والمساهمات والإدارة
تتطلب جلسة صالحة، بينما `/health` وبدء الجلسة فقط عامان.

## المصادقة

| Method | Path | الغرض |
|---|---|---|
| POST | `/auth/sandbox` | إنشاء حساب في Sandbox فقط |
| POST | `/auth/session` | تسجيل الدخول وإصدار HttpOnly cookie |
| GET | `/auth/me` | هوية وأدوار الجلسة |
| DELETE | `/auth/session` | إبطال الجلسة |

إنشاء دور أعلى من `user` في Sandbox يتطلب `x-sandbox-admin-key`.

## العالم

| Method | Path | الغرض |
|---|---|---|
| GET | `/world/summary` | Projection مختصرة وعدادات البيانات |
| GET | `/world/regions` | مناطق Cursor-paginated |
| GET | `/world/events` | أحداث سببية الأحدث أولًا |
| GET | `/world/timeline` | Snapshots للخط الزمني |

## المساهمة

```json
{
  "planetId": "uuid",
  "proposal": "شجرة عملاقة تمتص التلوث وتضيء ليلًا",
  "clientContext": { "regionId": "uuid" }
}
```

- `POST /contribution/analyze`: moderation، استشارة AI منظمة، وأثر خوارزمي.
- `POST /contribution/preview`: يضيف `samples` (50–2000) ويعيد uncertainty.
- `POST /contribution/commit`: يضيف `idempotencyKey` ويكتب Tick كاملًا.

إعادة نفس `idempotencyKey` للمستخدم والكوكب تعيد النتيجة السابقة مع
`replayed: true`.

## الإدارة

- `POST /admin/ticks/pause`
- `POST /admin/ticks/resume`
- `POST /admin/snapshots/rollback`

تتطلب أدوار `simulation_manager` أو `admin` أو `system_admin` أو
`super_admin`. كل إجراء يكتب Audit Log ويبث Delta.

## WebSocket

الاتصال:

```text
ws://localhost:3001/ws?planetId=<uuid>
```

تنتقل HttpOnly cookie أثناء handshake. الرسالة ليست نسخة عالم كاملة:

```json
{
  "type": "contribution.committed",
  "planetId": "uuid",
  "tick": 42,
  "payload": {
    "contributionId": "uuid",
    "snapshotId": "uuid",
    "events": []
  },
  "occurredAt": "2026-07-30T22:00:00.000Z"
}
```

الأنواع الأخرى: `simulation.paused`, `simulation.resumed`,
`timeline.rolled_back`. تعيد الواجهة جلب Projections المتأثرة فقط. عند تعذر
WebSocket تنتقل إلى polling كل 30 ثانية وتعرض حالته.
