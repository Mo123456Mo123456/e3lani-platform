# إعلاني | E3lani

منصة الإعلانات المرئية لكل شيء — Visual Advertising Platform for Everything.

> **جاهز تقنيًا للاختبار/Sandbox، وليس جاهزًا لتحصيل أموال حقيقية أو الإطلاق الإنتاجي.**

## البنية

```text
e3lani-platform/
├── apps/          # mobile (Expo) · web (Next.js) · admin (Next.js)
├── services/      # api (NestJS) · media-worker
├── packages/      # types · config · validation · auth · payments · i18n · ui
├── infrastructure/docker
├── docs/
└── tests/
```

## التسعير الافتراضي (السعودية)

| الخدمة | السعر |
|---|---|
| إعلان 30 يومًا | 59 ر.س |
| إعادة نشر | 10 ر.س |
| تمديد 15 يومًا | 29 ر.س |
| إبراز 3 أيام | 15 ر.س |
| إبراز 7 أيام | 29 ر.س |
| أعلى القسم | 29 ر.س |
| استهداف مدينة | 10 ر.س |

الأسعار تُدار من الخادم عبر `PricingVersion` — لا تُثبَّت في العملاء.

## التشغيل المحلي

```bash
pnpm install
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example .env
cp services/api/.env.example services/api/.env
pnpm --filter @e3lani/api prisma:generate
pnpm --filter @e3lani/api exec prisma migrate dev --name init
pnpm db:seed
pnpm dev
```

- API: `http://localhost:3001/api/v1` — Docs: `/api/docs`
- Web: `http://localhost:3000`
- Admin: `http://localhost:3002`
- OTP Sandbox: `123456`

## قواعد المنتج

- ليست متجرًا: لا سلة ولا تحصيل لقيمة منتجات المعلنين.
- المراجعة قبل الدفع دائمًا.
- لا Mock نجاح في Production عند نقص المفاتيح.

## الوثائق

- [`docs/requirements/PRODUCT_SPEC_AR.md`](docs/requirements/PRODUCT_SPEC_AR.md)
- [`docs/DELIVERY_STATUS.md`](docs/DELIVERY_STATUS.md)
- [`docs/IMPLEMENTATION_MATRIX.md`](docs/IMPLEMENTATION_MATRIX.md)
- [`docs/KEYS_AND_ACCOUNTS_AR.md`](docs/KEYS_AND_ACCOUNTS_AR.md)
- [`docs/requirements/ADVERTISING_POLICY_AR.md`](docs/requirements/ADVERTISING_POLICY_AR.md)
