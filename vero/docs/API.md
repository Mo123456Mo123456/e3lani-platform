# VERO — عقد الـAPI

- الأساس: `/v1`
- التوثيق التفاعلي: `GET /docs` (OpenAPI 3 عبر Swagger UI)
- مخطط JSON: `GET /docs/json`
- المصادقة:
  - لوحة الإدارة: `Authorization: Bearer <accessToken>` (JWT HS256)
  - تطبيق العامل: `Authorization: Device <deviceToken>`
- الأخطاء موحّدة:
```json
{ "error": { "code": "OUT_OF_RANGE", "message": "...", "details": {} } }
```

---

## Setup — التهيئة الأولى

| المسار | الوصف | الحماية |
|---|---|---|
| `GET /v1/setup/status` | هل اكتمل الإعداد؟ | عام |
| `POST /v1/setup` | إنشاء الشركة + أول مدير | متاح مرة واحدة فقط |

```jsonc
// POST /v1/setup
{
  "company": { "name":"شركة النظافة", "city":"الرياض", "phone":"...", "email":"...",
               "address":"...", "defaultGpsRadiusM": 30, "timezone":"Asia/Riyadh" },
  "admin":   { "fullName":"مدير النظام", "username":"admin", "email":"...", "password":"..." }
}
```

## Auth

| المسار | الوصف |
|---|---|
| `POST /v1/auth/login` | `{username,password}` → `{accessToken, refreshToken, user}` |
| `POST /v1/auth/refresh` | `{refreshToken}` → توكن جديد |
| `POST /v1/auth/logout` | إبطال الجلسة |
| `GET  /v1/auth/me` | بيانات المستخدم الحالي |

## Company / Settings

| المسار | الدور |
|---|---|
| `GET  /v1/company` | الكل |
| `PATCH /v1/company` | ADMIN |
| `POST /v1/company/logo` (multipart) | ADMIN |
| `GET  /v1/settings` · `PUT /v1/settings/:key` | ADMIN |

## Users (RBAC)

`GET/POST /v1/users` · `PATCH/DELETE /v1/users/:id` — **ADMIN فقط**
الأدوار: `ADMIN` (كل شيء) · `SUPERVISOR` (تشغيل + حاويات + سيارات + عمال + تقارير) · `VIEWER` (قراءة فقط).

## Workers · Vehicles

`GET/POST /v1/workers` · `PATCH/DELETE /v1/workers/:id`
`GET/POST /v1/vehicles` · `PATCH/DELETE /v1/vehicles/:id`
`POST /v1/vehicles/:id/assign` → `{workerId}` تغيير السائق.

## Bins — الحاويات

| المسار | الوصف |
|---|---|
| `GET /v1/bins` | فلترة: `q, sector, area, status, servicedOn, page, pageSize` |
| `POST /v1/bins` | إنشاء حاوية (ينشئ `qr_token` تلقائيًا) |
| `GET /v1/bins/:id` | تفاصيل + آخر زيارة |
| `PATCH /v1/bins/:id` · `DELETE /v1/bins/:id` | تعديل/حذف (ADMIN للحذف) |
| `POST /v1/bins/import` | استيراد CSV/Excel — يرجّع `{created, updated, failed[]}` |
| `GET /v1/bins/map` | نقاط مبسّطة للخريطة `{id, publicId, lat, lon, state}` |

## QR — مركز الرموز

| المسار | الوصف |
|---|---|
| `GET  /v1/qr/summary` | `{total, generated, printed, notPrinted}` |
| `POST /v1/qr/stickers` | `{binIds?, sector?, all?}` → PDF ملصقات جاهزة للطباعة |
| `POST /v1/qr/mark-printed` | تعليم مطبوع |
| `GET  /v1/qr/bin/:id.png` | صورة QR لحاوية واحدة |

## Devices — أجهزة العمال

| المسار | الحماية |
|---|---|
| `POST /v1/devices/activation-codes` | ADMIN/SUPERVISOR — `{workerId, vehicleId, ttlHours}` |
| `GET  /v1/devices/activation-codes` | قائمة الأكواد |
| `POST /v1/devices/activate` | **عام** (Rate limited) — `{code, deviceUid, platform, model, appVersion}` → `{deviceToken, worker, vehicle, company}` |
| `GET  /v1/devices/me` | Device — حالة الجهاز والعدادات اليومية |
| `POST /v1/devices/:id/revoke` | ADMIN |

## Scans — المسح

| المسار | الحماية | الوصف |
|---|---|---|
| `POST /v1/scans` | Device | مسح فوري متصل |
| `GET  /v1/scans` | Admin | فلترة: `from,to,status,binId,workerId,vehicleId,reviewStatus` |
| `GET  /v1/scans/:id` | Admin | سجل الإثبات الكامل |
| `POST /v1/scans/:id/review` | ADMIN/SUPERVISOR | `{reviewStatus:'ACCEPTED'|'REJECTED', note}` |
| `GET  /v1/scans/chain/verify` | ADMIN | التحقق من سلامة Proof Chain |

```jsonc
// POST /v1/scans  (Device)
{ "clientUuid":"…uuid…", "token":"vero1.VR-000248.a1b2…", "lat":24.7136, "lon":46.6753,
  "accuracyM":8.5, "scannedAt":"2026-09-04T06:12:00Z", "offline":false, "sessionId":"…" }
// → 201
{ "id":"…", "status":"VERIFIED", "counted":true, "distanceM":6.2, "reasons":[],
  "bin":{"publicId":"VR-000248","name":"…"}, "serviceDay":"2026-09-04" }
```

## Sync — وضع عدم الاتصال

| المسار | الوصف |
|---|---|
| `POST /v1/sync/scans` | `{items:[ScanInput,…]}` → `{results:[{clientUuid,outcome,scanId?,reason?}]}` |
| `POST /v1/sync/route-points` | `{sessionId, points:[…]}` → `{accepted, duplicates}` |
| `GET  /v1/sync/state` | Device — عدد ما لم يُزامَن حسب الخادم |

`outcome ∈ accepted | duplicate | rejected`. إعادة الإرسال بنفس `clientUuid` تُرجع `duplicate` بدون إنشاء سجل.

## Routes — خط سير السيارة

| المسار | الوصف |
|---|---|
| `POST /v1/routes/sessions` | Device — بدء جلسة عمل |
| `POST /v1/routes/sessions/:id/end` | Device — إنهاء الجلسة |
| `GET  /v1/routes/sessions` | Admin — فلترة بالتاريخ/السيارة |
| `GET  /v1/routes/sessions/:id` | Admin — GeoJSON LineString للمسار |
| `GET  /v1/routes/live` | Admin — آخر موقع لكل سيارة نشطة |

## Dashboard · Attention

| المسار | الوصف |
|---|---|
| `GET /v1/dashboard` | `{totalBins, servicedToday, remaining, needsReview, completionRate, activeVehicles, offlineVehicles, pendingSync}` |
| `GET /v1/attention` | قائمة الاستثناءات المصنّفة بالنوع والخطورة |

## Reports

| المسار | الوصف |
|---|---|
| `POST /v1/reports` | `{kind:'DAILY'|'WEEKLY'|'MONTHLY'|'CUSTOM', from, to, slaContractId?}` |
| `GET  /v1/reports` · `GET /v1/reports/:id` | قائمة/تفاصيل |
| `GET  /v1/reports/:id.pdf` | PDF رسمي بشعار الشركة + QR تحقق |
| `GET  /v1/reports/:id.xlsx` | Excel |
| `GET  /v1/verify/:token` | **عام** — صفحة/JSON تحقق من التقرير بدون بيانات حساسة |
| `GET/POST /v1/sla-contracts` | متطلبات العقد |

## Audit · Backups

| المسار | الحماية |
|---|---|
| `GET  /v1/audit` | ADMIN — فلترة بالفاعل/الكيان/التاريخ |
| `GET  /v1/backups` · `POST /v1/backups` | ADMIN |
| `GET  /v1/backups/:id/download` | ADMIN |
| `POST /v1/backups/restore` (multipart) | ADMIN |

## Health

`GET /health` → `{status:'ok', db:'ok', postgis:'3.4', version:'…'}` — يُرجع 503 عند فشل قاعدة البيانات.
