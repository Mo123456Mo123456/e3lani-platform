# REST وWebSocket contract

توثيق Swagger التفاعلي متاح في `/docs`. تستخدم مسارات REST البادئة `/api`.

## المصادقة

| Method | Path | الوصف |
|---|---|---|
| POST | `/api/v1/auth/register` | إنشاء مستخدم وإرجاع access token |
| POST | `/api/v1/auth/login` | تسجيل الدخول |
| POST | `/api/v1/auth/refresh` | تدوير HttpOnly refresh cookie |

مدة access token خمس عشرة دقيقة. عند كل refresh تزداد
`refresh_token_version`، فلا يمكن إعادة استعمال refresh token القديم. في
Sandbox فقط، تسمح أوامر العالم دون Bearer token وتستخدم Super Admin التجريبي؛
الإنتاج يرفض ذلك.

## العالم

| Method | Path | الوصف |
|---|---|---|
| GET | `/api/v1/worlds/current` | ملخص العالم وstate hash ونمط التخزين |
| GET | `/api/v1/worlds/:id/regions` | خلايا التضاريس والمناخ الحالية |
| GET | `/api/v1/worlds/:id/events` | أحدث الأحداث المرئية، بحد أقصى 200 |
| POST | `/api/v1/worlds/:id/ticks` | تشغيل 1–1000 Tick |
| GET | `/api/v1/worlds/:id/contributions/:id/causality` | nodes وedges السببية |

يخزن المحرك أحداث `SIMULATION_TICK_COMPLETED` لإعادة التشغيل، لكنه لا يعيدها
في سجل المستخدم كي لا تطغى على الأحداث الدلالية.

## الإضافات

### تحليل

```http
POST /api/v1/contributions/analyze
Content-Type: application/json

{
  "category": "plant",
  "idea": "أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل.",
  "locale": "ar"
}
```

تمر الاستجابة عبر Zod بعد تحقق Pydantic لدى AI orchestrator. يحتوي الرد دائمًا
على `provider` و`sandbox`. لا يعيد API fallback مخفيًا عند توقف خدمة AI؛ يعيد
`502 AI_ORCHESTRATOR_UNAVAILABLE`.

### تثبيت

```http
POST /api/v1/worlds/:worldId/contributions
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "analysis": { "...": "exact validated analysis response" },
  "regionId": "uuid",
  "idempotencyKey": "client-generated-uuid"
}
```

المفتاح يمنع تكرار المساهمة عند إعادة المحاولة. ينفذ الخادم في معاملة واحدة:
UserContribution ثم WorldEvent ثم region deltas ثم causal links ثم planet
state hash.

## WebSocket

Socket.IO namespace:

```text
ws://localhost:4000/world
```

النقل المسموح `websocket` وحجم الرسالة الأقصى 64 KiB. يمرر عميل الإنتاج access
token في `handshake.auth.token`.

عند الاتصال:

```json
{
  "event": "ready",
  "data": {
    "world": {},
    "protocolVersion": 1,
    "updateMode": "delta"
  }
}
```

جميع التحديثات اللاحقة تحت event باسم `delta`:

```ts
type Delta =
  | { kind: "world.event"; data: WorldEvent }
  | {
      kind: "world.tick";
      data: { id: string; currentTick: number; currentYear: number; stateHash: string };
    }
  | {
      kind: "contribution.status";
      data: { contributionId: string; status: "queued" | "simulating" | "committed" | "failed" };
    };
```

لا ترسل البوابة الحالة الكاملة بعد الاتصال. عند `world.event` يعيد العميل
تحميل المنطقة المتغيرة فقط في التطوير الحالي؛ العقد يسمح بإضافة region delta
صريح دون كسر protocolVersion 1.

## الأخطاء

- `400 VALIDATION_ERROR`: فشل عقد Zod.
- `401`: access/refresh token غائب أو منتهي أو معاد الاستخدام.
- `404`: العالم غير موجود.
- `422 PROMPT_INJECTION_DETECTED`: نص يحاول التحكم في تعليمات AI.
- `502 AI_ORCHESTRATOR_UNAVAILABLE`: مزود/خدمة AI لم ينجح؛ لم تسجل مساهمة.

## ضوابط الإنتاج غير المكتملة

توجد مصادقة وتدوير token وCSP وCORS وتحقق مدخلات. قبل فتح الخدمة للعامة يجب
إضافة RBAC guard دقيق لكل endpoint، CSRF token لطلبات cookie، Redis-backed
distributed throttling، وتحقيق Origin إضافي على WebSocket. لا تمثل هذه الوثيقة
تلك الضوابط كميزات مكتملة.
