# أحداث WebSocket / Realtime Events

Socket.IO على نفس منفذ API (افتراضي `:4000`)، مسار `/socket.io`.

<div dir="rtl">

## المصافحة

```ts
io(API_URL, { auth: { token: accessToken } })
```

JWT وصول إلزامي؛ الفشل ⇒ فصل فوري. عند النجاح: `session:ready { userId }` وغرفة `user:{id}` تلقائيًا.

## الغرف

```ts
socket.emit("subscribe:planet", { planetId })
socket.emit("unsubscribe:planet", { planetId })
```

## الأحداث من الخادم → العميل (دلتا فقط — لا حالة كاملة أبدًا)

| الحدث | الحمولة | متى |
|---|---|---|
| `event:new` | `{ planetId, event: WorldEvent }` | حدث جديد بأهمية ≥ 2 |
| `planet:tick` | `{ planetId, tick, hash }` | بعد كل tick مُقدَّم |
| `sim:state` | `{ planetId, status, tick }` | إيقاف/تشغيل/Rollback |
| `notification:new` | `{ notification: NotificationDto }` | إشعار شخصي (أثر مساهمة، إنجاز…) |
| `contribution:status` | `{ contributionId, status, detail? }` | مراحل المعالج (analyzing→previewing→previewed→applied) |
| `civ:update` | `{ planetId, civId, fields }` | تحديثات حضارة محجوزة للاستخدام القريب |

## سياسة التحديث

- الواجهة تدمج `event:new` في سجل الأحداث وتُحدّث tick؛ طبقات الخرائط تُعاد جلبها كسولًا أو عند أحداث أهمية ≥ 4.
- عند إعادة الاتصال: إعادة الاشتراك + جلب `?fromTick=lastTick` لسد الفجوة من REST (`/planets/:id/events`).

</div>

## English

JWT-authenticated Socket.IO gateway. Clients join `user:{id}` automatically and subscribe to `planet:{id}` rooms. The server pushes only deltas: new events (importance ≥ 2), tick heartbeats, sim state changes, personal notifications, and contribution pipeline status. Reconnects re-subscribe and backfill via the REST events feed with `fromTick`.
