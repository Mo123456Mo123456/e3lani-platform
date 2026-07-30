"use client";

import { API_URL, getAccessToken } from "./api";
import { useWorldStore } from "./store";
import type { PlanetStats, WorldDelta, WorldEvent } from "@kawkab/shared-types";

type ServerMessage =
  | { type: "hello"; version: number }
  | { type: "subscribed"; planetId: string; tick: number | null; stats: PlanetStats | null }
  | { type: "delta"; delta: WorldDelta }
  | { type: "event"; event: WorldEvent }
  | { type: "status"; running: boolean; tick: number }
  | { type: "pong"; t: number };

let socket: WebSocket | null = null;
let currentPlanet: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;
const listeners = new Set<(msg: ServerMessage) => void>();

export function onWsMessage(fn: (msg: ServerMessage) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function wsUrl(): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws`;
}

export function connectPlanet(planetId: string): void {
  if (currentPlanet === planetId && socket && socket.readyState <= 1) return;
  currentPlanet = planetId;
  disconnect(false);
  open();
}

function open(): void {
  if (!currentPlanet) return;
  const store = useWorldStore.getState();
  try {
    socket = new WebSocket(wsUrl());
  } catch {
    scheduleReconnect();
    return;
  }
  socket.onopen = () => {
    attempts = 0;
    useWorldStore.getState().setConnected(true);
    const token = getAccessToken();
    socket?.send(JSON.stringify({ type: "subscribe", planetId: currentPlanet, token: token ?? undefined }));
  };
  socket.onmessage = (ev) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(ev.data)) as ServerMessage;
    } catch {
      return;
    }
    if (msg.type === "subscribed") {
      if (msg.stats) useWorldStore.getState().setStats(msg.stats);
    } else if (msg.type === "delta") {
      useWorldStore.getState().applyDelta(msg.delta);
    } else if (msg.type === "event") {
      useWorldStore.getState().pushEvent(msg.event);
    }
    for (const fn of listeners) fn(msg);
  };
  socket.onclose = () => {
    store.setConnected(false);
    socket = null;
    scheduleReconnect();
  };
  socket.onerror = () => {
    socket?.close();
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = Math.min(15_000, 500 * 2 ** attempts++);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (currentPlanet) open();
  }, delay);
}

export function disconnect(clearPlanet = true): void {
  if (clearPlanet) currentPlanet = null;
  socket?.close();
  socket = null;
  useWorldStore.getState().setConnected(false);
}
