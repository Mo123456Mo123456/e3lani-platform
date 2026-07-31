# Services layout — قرارات التقسيم / Service topology

<div dir="rtl">

## ما الذي يوجد هنا ولماذا

| الخدمة | التقنية | الحالة |
|---|---|---|
| `api/` | NestJS + Kysely + Socket.IO | **المنسّق المركزي**: REST، مصادقة، RBAC، WebSocket، تنسيق المحاكاة، مهام خلفية |
| `simulation-engine/` | Python + FastAPI | حساب خالص: توليد، ticks، حقن، سيناريوهات، خرائط |
| `ai-orchestrator/` | Python + FastAPI | تحليل، توازن، سرد مُتحقق، مزوّدون |

## قرارات دمج موثقة (بدل مجلدات فارغة)

المواصفة الأصلية تسرد خدمات `realtime-gateway`, `notification-worker`, `world-generator` كوحدات مستقلة. في هذه النسخة اخترنا دمجها بوضوح داخل الوحدات الموجودة لتقليل التعقيد التشغيلي مع إبقاء حدود المسؤولية:

- **realtime-gateway** → `api/src/realtime/realtime.gateway.ts` (Socket.IO داخل API). عند تعدد نسخ API يُستخرج كخدمة مستقلة مع ناقل Redis/NATS — العقد محفوظ في `docs/WEBSOCKETS.md`.
- **notification-worker** → قواعد الإشعارات في `api/src/notifications` + حلقة مهام `jobs` (SKIP LOCKED) داخل API. تُستخرج عند الحاجة لمعدل أحداث أعلى.
- **world-generator** → وحدة `app/generator.py` داخل `simulation-engine` (التوليد والمحاكاة يشتركان في نفس نموذج الحالة؛ فصلهما شبكيًا يضاعف تسلسل الحالة بلا فائدة).

أي خدمة غير مستقلة **غير ممثلة بمجلد** احترامًا لقاعدة «لا تُعرض الميزة غير المفعلة كمكتملة».

</div>

## English

Three real services: `api` (NestJS orchestrator), `simulation-engine` (pure-compute Python), `ai-orchestrator` (Python). The realtime gateway, notification worker, and world generator are deliberately consolidated as modules inside these services (documented decision with extraction paths) rather than represented by empty placeholder folders.
