# واجهات API وWebSocket / API & WebSocket Reference

Base: `http://localhost:4000` · المصادقة: `Authorization: Bearer <accessToken>`
· Refresh: كوكي HttpOnly `planet_refresh` على `/auth/*` (SameSite=strict).

## Auth

| Method | Path | الوصف |
|---|---|---|
| POST | `/auth/register` | `{email,password,displayName,locale}` → مستخدم + زوج رموز |
| POST | `/auth/login` | → `{accessToken, expiresIn}` + كوكي refresh |
| POST | `/auth/refresh` | تدوير — القديم يُبطل فورًا؛ إعادة الاستخدام تبطل العائلة |
| POST | `/auth/logout` | إبطال refresh الحالي |

## Worlds

| Method | Path | الوصف |
|---|---|---|
| GET | `/worlds` | قائمة الكواكب + عدادات |
| GET | `/worlds/:id` | تفاصيل + عدادات الكيانات |
| GET | `/worlds/:id/grid` | قنوات الشبكة (elevation/biome/temp/moisture/pollution/ice/river) |
| GET | `/worlds/:id/snapshot` | لقطة حية: حضارات/مدن/حروب/تحالفات/طرق/علاقات |
| GET | `/worlds/:id/regions/:cell` | بيانات منطقة (بيوم/خصوبة/موارد/أنواع) |
| GET | `/worlds/:id/timeline` | لقطات زمنية للمقارنة |
| GET | `/worlds/:id/events?beforeSeq&limit&type&contributionId` | سجل الأحداث (cursor) |
| GET | `/worlds/:id/causal/:seq` | أسلاف + أحفاد الحدث (الخريطة السببية) |
| POST | `/worlds/:id/ticks` `{count}` | تقديم المحاكاة — دور simulation_manager+ |
| POST | `/worlds/:id/rollback` `{tick}` | استرجاع لقطة — simulation_manager+ |

## Contributions (مصادق)

| Method | Path | الوصف |
|---|---|---|
| POST | `/contributions` `{category,text,worldId}` | مسودة (rate-limited) |
| POST | `/contributions/:id/analyze` `{locale}` | تحليل AI + توازن + إشراف |
| POST | `/contributions/:id/preview` `{cellIndex}` | Monte Carlo 1/10/100/1000 سنة |
| POST | `/contributions/:id/confirm` | تطبيق في العالم + استمرار + بث |
| GET | `/contributions/mine` | مساهماتي |
| GET | `/contributions/:id/impact` | كل الأحداث الناتجة عنها |

## Users / Notifications / AI

- `GET /users/me` — الملف + المساهمات + impactScore
- `GET /notifications?unread` · `POST /notifications/:id/read` · `POST /notifications/read-all`
- `GET /ai/providers` — حالة المزودين بصدق (live/no key/sandbox)
- `POST /ai/narrate` `{locale,facts}` — سرد مؤسَّس (يحذف الحقائق المختلقة)

## Admin (أدوار content_moderator+، بعضها system_admin+)

`/admin/overview` · `/admin/users` · `POST /admin/users/role` ·
`POST /admin/users/:id/suspend` · `/admin/contributions/review` ·
`/admin/ai-usage` · `/admin/ai-providers` · `/admin/audit-logs` ·
`/admin/moderation` · `/admin/services/health`

## Internal (خدمة↔خدمة، `x-internal-token`)

- `POST /internal/notify-impact` — عامل الإشعارات
- `POST /internal/planets/register` — مولّد العوالم

## WebSocket — `/realtime?token=<accessToken>`

العميل يرسل: `{"action":"subscribe","worldId":"demo-world"}`

رسائل الخادم (Delta فقط — لا إعادة إرسال الحالة كاملة):

```json
{"kind":"world.event","worldId":"…","event":{…}}
{"kind":"tick.completed","worldId":"…","tick":341,"year":341,"eventCount":7}
{"kind":"notification","userId":"…","notification":{…}}
{"kind":"contribution.status","contributionId":"…","status":"applied"}
```

## أخطاء شائعة

`rate_limit_exceeded` · `moderation_blocked` · `contribution_rejected_by_balance`
· `preview_first` / `analyze_first` · `plants_need_land` · `unsuitable_habitat`
· `territory_occupied` · `refresh_token_reuse_detected`

## OpenAPI

الخدمات الثانوية (engine/orchestrator) Fastify بعقود Zod مشتركة من
`@planet/validation`. توليد وثيقة OpenAPI تفاعلية (Swagger UI) خطوة لاحقة موثقة
— العقود نفسها هي مصدر الحقيقة البرمجي المفروض على الطرفين.
