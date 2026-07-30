# @planet-born/web

واجهة العالم العامة مبنية بـ Next.js وReact Three Fiber.

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @planet-born/web dev
```

تعمل الواجهة على `http://localhost:3000` وتتصل افتراضيًا بـ API على المنفذ 4000 وبوابة WebSocket على المنفذ 4300. عند غياب الخادم يبقى الكوكب الإجرائي قابلًا للتفاعل وتظهر بيانات fallback مميزة بوضوح.

## PWA

يتوفر manifest أساسي قابل للتثبيت في `public/manifest.json`. عامل الخدمة (service worker) معطّل حاليًا عمدًا؛ لذلك لا تدّعي الواجهة دعم العمل الكامل دون اتصال أو تخزين استجابات API.
