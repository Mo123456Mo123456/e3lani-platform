# دليل التشغيل وربط الخدمات — إعلاني

## 1) المتطلبات

- Node.js ≥ 20
- pnpm 9+
- Docker (PostgreSQL + Redis + MinIO)

## 2) التشغيل السريع

```bash
pnpm install
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example .env
cp services/api/.env.example services/api/.env
pnpm --filter @e3lani/api prisma:generate
pnpm --filter @e3lani/api exec prisma migrate deploy
pnpm db:seed
pnpm --filter @e3lani/api start
```

## 3) ربط الخدمات الخارجية

| الخدمة | المتغيرات | ملاحظات |
|---|---|---|
| OTP إنتاجي | `OTP_MODE=production`, `OTP_PROVIDER=twilio`, `TWILIO_*` | بدونها Production يرفض البدء بـ mock |
| الدفع | `PAYMENT_MODE=production`, `PAYMENT_PROVIDER=moyasar`, `MOYASAR_*` | Webhook موقّع فقط ينشّط الإعلان |
| التخزين | `R2_*` أو MinIO | لا تعتمد على URI محلي دائم |
| الإشعارات | `FCM_SERVER_KEY` / SMTP | اختياري في FREE_LAUNCH |
| المراجعة الآلية | `MODERATION_MODE=production`, `MODERATION_API_KEY` | الفحص البشري بعد البلاغ |

## 4) تفعيل الدفع لاحقًا

1. من لوحة الإدارة: `PATCH /admin/launch-mode` → `PAID_ONLY`
2. عطّل مزود sandbox وفعّل Moyasar/MyFatoorah
3. المسار يصبح: مسودة → بانتظار الدفع → نشط (عبر webhook)

## 5) ملف ZIP

يُنشأ عبر:

```bash
bash scripts/make-delivery-zip.sh
```
