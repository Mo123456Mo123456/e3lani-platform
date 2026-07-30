# @planet/notification-worker

Phase worker for notification creation.

The worker listens to Redis channel `planet:deltas`, derives notification candidates from high-signal delta types, and currently emits structured logs. A later phase can replace `createNotification` with either:

- an authenticated API call to a future admin notification endpoint, or
- a direct `@planet/db` write when the notification schema is finalized for worker ownership.

It does not publish realtime messages itself; the realtime gateway remains the only WebSocket relay.
