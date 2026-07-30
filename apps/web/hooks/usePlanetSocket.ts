"use client";

import { useEffect } from "react";
import { WS_URL } from "@/lib/api";
import { useAppStore } from "@/stores/app";

export function usePlanetSocket() {
  const setTick = useAppStore((s) => s.setTick);
  const pushEvent = useAppStore((s) => s.pushEvent);
  const pushNotification = useAppStore((s) => s.pushNotification);
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 1000;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        retry = 1000;
        if (user?.id) {
          ws?.send(JSON.stringify({ type: "auth", userId: user.id }));
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "simulation.tick") {
            setTick(msg.payload.tick, msg.payload.year);
          } else if (msg.type === "world.event") {
            pushEvent(msg.payload);
          } else if (msg.type === "notification") {
            pushNotification(msg.payload);
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setTimeout(connect, retry);
        retry = Math.min(10000, retry * 1.5);
      };
    };
    connect();
    return () => {
      closed = true;
      ws?.close();
    };
  }, [user?.id, setTick, pushEvent, pushNotification]);
}
