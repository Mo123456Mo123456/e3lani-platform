# notification-worker

**Status: implemented inline in the API — not a separate worker yet.**

Notification derivation happens in two places inside `services/api`:

- [`../api/src/notifications/service.ts`](../api/src/notifications/service.ts)
  maps engine events to per-user notification templates
- `WorldManager.deriveNotifications()` persists them and pushes them over
  the realtime gateway

Delivery channels beyond WebSocket (email, push) and queue-backed retries
belong in a real worker process fed by the event bus. That channel layer is
**not activated** — the README in `services/realtime-gateway` documents the
same event-bus extraction path.
