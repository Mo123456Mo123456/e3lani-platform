import type { WorldEvent } from "./api";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4300";

export function connectWorldSocket(
  onEvent: (event: WorldEvent) => void,
  onStatus: (connected: boolean) => void = () => undefined,
) {
  if (typeof window === "undefined") return () => undefined;

  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const connect = () => {
    socket = new WebSocket(WS_URL);
    socket.addEventListener("open", () => onStatus(true));
    socket.addEventListener("message", ({ data }) => {
      try {
        const payload = JSON.parse(String(data)) as { type?: string; event?: WorldEvent } | WorldEvent;
        const event = "event" in payload && payload.event ? payload.event : (payload as WorldEvent);
        if (event?.id && event?.title) onEvent(event);
      } catch {
        // Ignore non-JSON gateway heartbeats.
      }
    });
    socket.addEventListener("close", () => {
      onStatus(false);
      if (!closed) retry = setTimeout(connect, 4000);
    });
    socket.addEventListener("error", () => onStatus(false));
  };

  connect();
  return () => {
    closed = true;
    onStatus(false);
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}
