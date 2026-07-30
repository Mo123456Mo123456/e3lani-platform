# الواجهات البرمجية — API & WebSocket

REST تحت البادئة `/api`، وثائق تفاعلية كاملة (Swagger/OpenAPI) على `/docs` عند تشغيل الخادم. ملخص:

## المصادقة
| Method | Path | الوصف |
|---|---|---|
| POST | `/api/auth/register` | تسجيل (بريد/كلمة مرور) |
| POST | `/api/auth/login` | دخول — كوكي refresh httpOnly |
| POST | `/api/auth/refresh` | تدوير الرمز (كشف إعادة الاستخدام) |
| POST | `/api/auth/logout` | إبطال الرمز |
| GET | `/api/auth/me` | الجلسة الحالية |
| GET | `/api/auth/google` · `/apple` | محولات OAuth — `501` حتى التهيئة |

## العوالم (عامة)
| Method | Path |
|---|---|
| GET | `/api/worlds` · `/api/worlds/:id` |
| GET | `/api/worlds/:id/regions/:index` |
| GET | `/api/worlds/:id/layers/:layerId` (surface/biome/weather/civilization/resource/conflict/migration/trade/pollution/temperature/history) |
| GET | `/api/worlds/:id/civilizations` · `/civilizations/:civId` |
| GET | `/api/worlds/:id/cities` · `/species` · `/plants` · `/technologies` · `/trade-routes` · `/alliances` · `/wars` · `/migrations` |
| POST | `/api/worlds` (SIM_ADMIN+) — توليد كوكب جديد من بذرة |

## المساهمات (مسجّل)
| Method | Path | الوصف |
|---|---|---|
| POST | `/api/contributions?locale=ar` | المرحلة 1: إشراف → تحليل → توازن → معاينة (مواقع مقترحة + احتمالية نجاح + آثار متوقعة) |
| POST | `/api/contributions/confirm` | المرحلة 2: إدخال العنصر + 5 نبضات فورية + سرد مؤسَّس |
| GET | `/api/contributions/mine` | مساهماتي |
| GET | `/api/contributions/:id` · `/trace` | التفصيل والخريطة السببية |
| GET | `/api/contributions/:id/scenarios` | سيناريوهات Monte Carlo 1/10/100/1000 سنة |

## الأحداث والمحاكاة
| Method | Path |
|---|---|
| GET | `/api/planets/:planetId/events?page=&types=&fromTick=&contributionId=` |
| GET | `/api/planets/:planetId/events/timeline` |
| GET | `/api/planets/:planetId/events/:eventId/chain` |
| GET | `/api/simulation/:planetId/status` · `/snapshots` · `/compare?from=&to=` |
| POST | `/api/simulation/:planetId/start` · `/pause` · `/step` · `/rollback` (SIM_ADMIN+) |

## المستخدم والإشعارات
`GET /api/users/me/dashboard` · `GET/PATCH /api/notifications…`

## الإدارة (أدوار)
`GET /api/admin/overview|users|ai-usage|simulations|audit-logs|contributions|ticks/:planetId` · `PATCH /api/admin/users/:id/role|ban` · `GET/PATCH /api/moderation/queue|:id`

## WebSocket — `/ws`

الرسائل من العميل:
```json
{ "type": "subscribe", "planetId": "…", "token": "<accessToken؟>" }
{ "type": "unsubscribe", "planetId": "…" }
{ "type": "ping" }
```

من الخادم (Delta فقط، لا حالة كاملة):
```json
{ "type": "subscribed", "planetId": "…", "tick": 142, "stats": {…} }
{ "type": "delta", "delta": { "fromTick": 142, "toTick": 143, "simYear": 143,
    "changedRegions": [{ "index": 512, "pollution": 0.42, "population": 900, … }],
    "newEvents": [ WorldEvent… ], "stats": {…} } }
{ "type": "event", "event": { WorldEvent } }        // الأحداث المهمة فورًا
{ "type": "status", "running": true, "tick": 143 }
```

نبضات ping/pong كل 30 ثانية؛ إعادة اتصال أسّية في العميل.
