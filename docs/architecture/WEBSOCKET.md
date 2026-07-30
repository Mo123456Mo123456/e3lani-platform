# WebSocket Events

Gateway: `services/realtime-gateway` on port `4300`

## Client protocol

Connect: `ws://localhost:4300`

Subscribe:

```json
{ "action": "subscribe", "planetId": "<uuid>" }
```

Unsubscribe:

```json
{ "action": "unsubscribe", "planetId": "<uuid>" }
```

## Server envelope

```json
{
  "type": "world.event" | "simulation.tick" | "contribution.applied" | "ai.status" | "notification",
  "planetId": "<uuid>",
  "payload": {},
  "ts": 1710000000000
}
```

## Publish (internal)

`POST /publish`

```json
{ "type": "world.event", "planetId": "<uuid>", "payload": { "event": {} } }
```

Delta updates only — never the full planet state on every message.
