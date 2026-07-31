"use client";

import type { RealtimeMessage } from "@planet/shared-types";
import { getAccessToken, API_URL } from "./api";
import { useEventsStore, useUiStore } from "./store";

let socket: WebSocket | null = null;
let reconnectDelay = 1000;
let currentWorldId: string | null = null;

/** Connect the realtime channel and subscribe to a world's delta stream. */
export function connectRealtime(worldId: string): () => void {
  currentWorldId = worldId;
  disconnect();

  const token = getAccessToken();
  const wsUrl = `${API_URL.replace(/^http/, "ws")}/realtime?token=${token ?? "guest"}`;
  let closed = false;

  const open = () => {
    if (closed) return;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      schedule();
      return;
    }
    socket.onopen = () => {
      reconnectDelay = 1000;
      socket?.send(JSON.stringify({ action: "subscribe", worldId }));
      useEventsStore.getState().setConnected(true);
    };
    socket.onmessage = (msg) => {
      try {
        const data = JSON.parse(String(msg.data)) as RealtimeMessage | { kind: string };
        handleMessage(data as RealtimeMessage);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      useEventsStore.getState().setConnected(false);
      if (!closed) schedule();
    };
    socket.onerror = () => socket?.close();
  };

  const schedule = () => {
    setTimeout(open, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 15000);
  };

  open();
  return () => {
    closed = true;
    disconnect();
  };
}

function handleMessage(msg: RealtimeMessage): void {
  switch (msg.kind) {
    case "world.event":
      useEventsStore.getState().push(msg.event);
      break;
    case "notification":
      useUiStore.getState().pushNotification(msg.notification);
      break;
    case "tick.completed":
      break; // events arrive individually; the counter updates via API refresh
    case "contribution.status":
      break;
  }
}

function disconnect(): void {
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

export function resubscribe(worldId: string): void {
  currentWorldId = worldId;
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action: "subscribe", worldId }));
  }
}

export { currentWorldId };
