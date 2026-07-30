type Handler = (msg: WsMessage) => void;

export type WsMessage = {
  type: string;
  planetId?: string;
  userId?: string;
  tick?: number;
  events?: unknown[];
  patches?: unknown[];
  payload?: Record<string, unknown>;
  channel?: string;
  error?: string;
};

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001/ws";

export class PlanetSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private planetId: string | null = null;
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  connect(token: string, planetId?: string) {
    this.token = token;
    this.planetId = planetId || null;
    this.closed = false;
    this.open();
  }

  private open() {
    if (!this.token || typeof window === "undefined") return;
    try {
      this.ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(this.token)}`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (this.planetId) {
        this.ws?.send(JSON.stringify({ action: "subscribe", planetId: this.planetId }));
      }
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as WsMessage;
        this.handlers.forEach((h) => h(msg));
      } catch {
        /* ignore */
      }
    };

    this.ws.onclose = () => {
      if (!this.closed) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  subscribePlanet(planetId: string) {
    this.planetId = planetId;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "subscribe", planetId }));
    }
  }

  on(handler: Handler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, 3000);
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export const planetSocket = new PlanetSocket();
