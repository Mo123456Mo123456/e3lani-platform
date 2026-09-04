# VERO — مخطط قاعدة البيانات

PostgreSQL 16 + PostGIS 3. المصدر التنفيذي الرسمي: `backend/src/db/migrations/*.sql`.
كل الجداول تحمل `company_id` رغم أن النسخة Single-Tenant، لضمان سلامة الاستعلامات ومنع أي تسرّب لو نُسخت قاعدة بيانات.

## الجداول

### `companies` — هوية الشركة (صف واحد)
| عمود | نوع | ملاحظات |
|---|---|---|
| id | uuid PK | |
| name | text | يظهر في اللوحة والملصقات والتقارير |
| logo_path | text NULL | مسار داخل مجلد التخزين |
| city, phone, email, address | text | |
| default_gps_radius_m | int | 20 / 30 / 50 / مخصص |
| timezone | text | افتراضي `Asia/Riyadh` — أساس حساب `service_day` |
| setup_completed_at | timestamptz NULL | يمنع إعادة تشغيل الـWizard |

### `users` — مستخدمو لوحة الإدارة
`id, company_id, full_name, username UNIQUE, email, password_hash, password_salt, role, is_active, last_login_at`
`role ∈ ('ADMIN','SUPERVISOR','VIEWER')`

### `workers` — العمال والسائقون
`id, company_id, full_name, employee_no UNIQUE, phone, status, default_vehicle_id, created_at`

### `vehicles` — السيارات
`id, company_id, internal_no UNIQUE, name, plate_no, vehicle_type, status, current_worker_id, last_seen_at, last_location geography(Point,4326)`

### `bins` — الحاويات / نقاط الخدمة
| عمود | نوع | ملاحظات |
|---|---|---|
| id | uuid PK | |
| public_id | text UNIQUE | `VR-000248` — يظهر على الملصق |
| name, sector, area, address | text | |
| location | geography(Point,4326) NOT NULL | فهرس GiST |
| gps_radius_m | int | يرث افتراضي الشركة عند الإنشاء |
| status | text | `ACTIVE` / `DISABLED` |
| qr_printed_at | timestamptz NULL | لمتابعة مركز QR |

### `qr_tokens` — رموز الحاويات
`id, company_id, bin_id, nonce, token_version, is_active, created_at, revoked_at`
الرمز المطبوع = `vero1.<bin.public_id>.<nonce>.<hmac>`. إعادة الطباعة **لا** تغيّر النونس ولا تنشئ حاوية جديدة.

### `devices` + `device_bindings`
`devices: id, company_id, device_uid, platform, model, app_version, token_hash, status, last_seen_at`
`device_bindings: id, device_id, worker_id, vehicle_id, bound_at, unbound_at`
`activation_codes: id, company_id, code UNIQUE, worker_id, vehicle_id, expires_at, consumed_at, consumed_device_id`

### `scans` — الزيارات (قلب النظام)
| عمود | نوع | ملاحظات |
|---|---|---|
| id | uuid PK | |
| client_uuid | uuid UNIQUE | Idempotency لمزامنة Offline |
| bin_id, worker_id, vehicle_id, device_id | uuid | |
| scanned_at | timestamptz | وقت المسح على الجهاز |
| received_at | timestamptz | وقت وصوله للخادم |
| service_day | date | مشتق بتوقيت الشركة |
| location | geography(Point,4326) | موقع المسح |
| gps_accuracy_m | real NULL | |
| distance_m | double precision | المسافة إلى الحاوية |
| status | text | `VERIFIED` / `SUSPICIOUS` / `INVALID` |
| counted | boolean | `true` للزيارة المعتمدة الوحيدة في اليوم |
| duplicate_of | uuid NULL | يشير للزيارة المعتمدة عند التكرار |
| offline | boolean | هل نشأ في وضع عدم الاتصال |
| reasons | text[] | أسباب الاشتباه/الرفض |
| proof_hash, prev_hash | text | سلسلة الإثبات |
| review_status, reviewed_by, reviewed_at, review_note | | مراجعة الإدارة |

**فهرس فريد جزئي:** `UNIQUE (bin_id, service_day) WHERE counted`
**فهرس فريد:** `UNIQUE (client_uuid)`

### `scan_attempts` — كل محاولة مسح حتى المرفوضة
`id, company_id, bin_id NULL, raw_token, device_id NULL, worker_id NULL, result, reason, location, created_at`

### `route_sessions` + `route_points`
`route_sessions: id, company_id, worker_id, vehicle_id, device_id, started_at, ended_at, points_count, distance_m`
`route_points: id, session_id, client_uuid UNIQUE, recorded_at, location geography, speed_mps, accuracy_m`

### `reports` + `report_items`
`reports: id, company_id, report_no UNIQUE, kind, period_start, period_end, verify_token UNIQUE, payload jsonb, created_by, created_at`
`report_items: id, report_id, dimension, key, label, required, verified, suspicious, invalid, missed, ratio`

### `sla_contracts` — متطلبات العقد
`id, company_id, name, required_visits_per_day, scope_sector NULL, active_from, active_to`

### `audit_logs`
`id, company_id, actor_user_id NULL, actor_device_id NULL, action, entity, entity_id, before jsonb, after jsonb, ip, user_agent, created_at`

### `settings`
`company_id, key, value jsonb` — إعدادات تشغيلية قابلة للتغيير من اللوحة.

### `backups`
`id, company_id, filename, size_bytes, kind, status, created_by, created_at`

---

## الفهارس الأساسية

```sql
CREATE INDEX bins_location_gix    ON bins USING GIST (location);
CREATE INDEX scans_day_idx        ON scans (service_day, status);
CREATE INDEX scans_bin_day_idx    ON scans (bin_id, service_day);
CREATE UNIQUE INDEX scans_daily_unique ON scans (bin_id, service_day) WHERE counted;
CREATE UNIQUE INDEX scans_client_uuid_unique ON scans (client_uuid);
CREATE INDEX route_points_session_idx ON route_points (session_id, recorded_at);
CREATE INDEX route_points_gix     ON route_points USING GIST (location);
```

## حساب المسافة

```sql
ST_Distance(bins.location, ST_SetSRID(ST_MakePoint($lon,$lat),4326)::geography)
```
يُرجع أمتارًا حقيقية على سطح الأرض (لا حاجة لتحويل إسقاط).
