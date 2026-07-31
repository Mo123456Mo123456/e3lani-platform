"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { WorldEvent, NotificationDto } from "@planet/shared-types";
import { useAuthStore } from "./auth-store";

const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;
  if (!socket || socket.disconnected) {
    socket = io(wsUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionDelayMax: 8000,
    });
  }
  return socket;
}

export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
}

export interface LiveHandlers {
  onEvent?: (e: WorldEvent) => void;
  onTick?: (tick: number) => void;
  onNotification?: (n: NotificationDto) => void;
  onContributionStatus?: (status: { contributionId: string; status: string; detail?: Record<string, unknown> }) => void;
}

/** Subscribe to the planet room + personal room with delta updates only. */
export function useLivePlanet(planetId: string | null, handlers: LiveHandlers): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (!token || !planetId) {
      setConnected(false);
      return;
    }
    const s = getSocket();
    if (!s) return;

    const onConnect = () => {
      setConnected(true);
      s.emit("subscribe:planet", { planetId });
    };
    const onDisconnect = () => setConnected(false);
    const onEvent = (payload: { event: WorldEvent }) => ref.current.onEvent?.(payload.event);
    const onTick = (payload: { tick: number }) => ref.current.onTick?.(payload.tick);
    const onNotification = (payload: { notification: NotificationDto }) =>
      ref.current.onNotification?.(payload.notification);
    const onContribution = (payload: { contributionId: string; status: string; detail?: Record<string, unknown> }) =>
      ref.current.onContributionStatus?.(payload);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("event:new", onEvent);
    s.on("planet:tick", onTick);
    s.on("notification:new", onNotification);
    s.on("contribution:status", onContribution);
    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("event:new", onEvent);
      s.off("planet:tick", onTick);
      s.off("notification:new", onNotification);
      s.off("contribution:status", onContribution);
    };
  }, [planetId]);

  return { connected };
}
