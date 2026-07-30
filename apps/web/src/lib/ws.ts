"use client";

/**
 * Realtime client — WebSocket with exponential-backoff reconnect.
 * Applies delta updates to the store; never reloads the page.
 */
import type { RealtimeMessage } from "@planet/shared-types";
import { BASE_URL, loadSession } from "./api";
import { useAppStore } from "./store";

let socket: WebSocket | null = null;
let retryMs = 1000;
let closedByUser = false;

export function connectRealtime(planetId: string): () => void {
  closedByUser = false;

  const open = () => {
    const session = loadSession();
    const wsUrl = new URL(`${BASE_URL.replace(/^http/, "ws")}/planets/${planetId}/stream`);
    if (session) wsUrl.searchParams.set("token", session.tokens.accessToken);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      retryMs = 1000;
      useAppStore.getState().setConnected(true);
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as RealtimeMessage;
      const store = useAppStore.getState();
      switch (message.kind) {
        case "hello":
          store.applyTick(message.tick, message.year);
          break;
        case "tick":
          store.applyTick(message.tick, message.year);
          break;
        case "events":
          store.appendEvents(message.events);
          break;
        case "delta":
          store.applyDelta(message.changes);
          break;
        case "notification":
          store.appendNotification(message.notification);
          break;
        case "contribution":
          break;
      }
    };
    socket.onclose = () => {
      useAppStore.getState().setConnected(false);
      if (!closedByUser) {
        retryMs = Math.min(retryMs * 2, 15000);
        setTimeout(open, retryMs);
      }
    };
    socket.onerror = () => socket?.close();
  };

  open();
  return () => {
    closedByUser = true;
    socket?.close();
    socket = null;
  };
}
