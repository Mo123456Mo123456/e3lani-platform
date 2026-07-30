import type { WebSocket } from "ws";
import type { WsEnvelope } from "@planet/shared-types";

type Client = {
  socket: WebSocket;
  userId?: string;
  planetId?: string;
};

const clients = new Set<Client>();

export function addClient(socket: WebSocket) {
  const client: Client = { socket };
  clients.add(client);
  socket.on("close", () => clients.delete(client));
  return client;
}

export function broadcast(envelope: WsEnvelope, planetId?: string) {
  const raw = JSON.stringify(envelope);
  for (const client of clients) {
    if (planetId && client.planetId && client.planetId !== planetId) continue;
    if (client.socket.readyState === 1) {
      client.socket.send(raw);
    }
  }
}

export function sendToUser(userId: string, envelope: WsEnvelope) {
  const raw = JSON.stringify(envelope);
  for (const client of clients) {
    if (client.userId === userId && client.socket.readyState === 1) {
      client.socket.send(raw);
    }
  }
}
