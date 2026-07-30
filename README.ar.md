# كوكب يولد أمامك

**عالمك، قرارك، أثر لا ينتهي.**

منصة محاكاة سببية لكوكب ثلاثي الأبعاد حي. المستخدم يضيف عنصرًا واحدًا؛ محرك الخوارزميات يحسب الأثر؛ الذكاء الاصطناعي يشرح النتائج فقط.

للتعليمات الكاملة والتشغيل والحسابات التجريبية راجع [README.md](./README.md).

## أوامر سريعة

```bash
cp .env.example .env
pnpm install && bash scripts/setup-python.sh
pnpm --filter @planet/db exec prisma db push
pnpm db:seed
pnpm dev:sim   # :8001
pnpm dev:ai    # :8002
pnpm --filter @planet/api dev
pnpm --filter @planet/web dev
```

## حسابات التجربة

- مدير: `admin@planet-born.local` / `PlanetAdmin!2026`
- مستكشف: `explorer@planet-born.local` / `Explorer!2026`
