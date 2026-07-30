# كوكب يولد أمامك

**عالمك، قرارك، أثر لا ينتهي.**

منصة كوكب إجرائي حي: محرك محاكاة حتمي، رسوم سببية، محولات ذكاء اصطناعي للشرح فقط، كرة أرضية WebGL، PostgreSQL، وتحديثات فورية.

## التشغيل السريع

```bash
cp .env.example .env
pnpm install
pnpm --filter @planet/config --filter @planet/shared-types --filter @planet/validation --filter @planet/simulation-models --filter @planet/analytics --filter @planet/ui build
pnpm db:migrate
pnpm db:seed
pnpm --filter @planet/ai-orchestrator dev
pnpm --filter @planet/api dev
pnpm --filter @planet/web dev
```

- الواجهة: http://localhost:3000  
- توثيق API: http://localhost:4100/docs  
- الإدارة: http://localhost:3001 (بدون رابط في واجهة المستخدم)

## حسابات Sandbox

| الدور | البريد | كلمة المرور |
|---|---|---|
| Super Admin | `superadmin@planet.local` | `PlanetAdmin!23` |
| مستكشف | `explorer@planet.local` | `Explorer!23` |

عند غياب مفاتيح المزودين يُستخدم مزود `mock` مع العلم `sandbox: true`.

## مبدأ مهم

النتائج الأساسية تخرج من خوارزميات المحاكاة. الذكاء الاصطناعي يحوّل الفكرة إلى خصائص منظمة ويشرح النتائج دون اختلاق أحداث غير موجودة في بيانات المحاكاة.

التفاصيل التقنية في `docs/` والنسخة الإنجليزية في `README.md`.
