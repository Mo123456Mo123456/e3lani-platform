import type { WorldDelta } from "@planet/shared-types";

export interface RealtimeClient {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export class RealtimeHub {
  private readonly clients = new Set<RealtimeClient>();

  add(client: RealtimeClient): () => void {
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  broadcastDelta(delta: WorldDelta): void {
    const message = JSON.stringify({ type: "world.delta", payload: delta });
    for (const client of this.clients) {
      if (client.readyState === 1) client.send(message);
    }
  }

  close(): void {
    for (const client of this.clients)
      client.close(1001, "Gateway shutting down");
    this.clients.clear();
  }

  get size(): number {
    return this.clients.size;
  }
}
