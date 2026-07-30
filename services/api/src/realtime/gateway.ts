/**
 * Realtime gateway — WebSocket streaming of ticks, events, deltas and
 * personal notifications. Clients receive incremental StateDelta updates;
 * the full world state is never re-sent after the hello handshake.
 *
 * Auth: browsers pass the access token as ?token=...; unauthenticated
 * sockets may watch public world streams but never receive user-targeted
 * notifications.
 */
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { RealtimeMessage } from "@planet/shared-types";
import type { AppContext } from "../context";

export function registerRealtimeGateway(app: FastifyInstance, ctx: AppContext): void {
  app.get("/planets/:planetId/stream", { websocket: true }, async (socket: WebSocket, request) => {
    const { planetId } = request.params as { planetId: string };
    const { token } = request.query as { token?: string };

    let userId: string | null = null;
    if (token) {
      try {
        const payload = app.jwt.verify<{ sub: string }>(token);
        userId = payload.sub;
      } catch {
        socket.close(4401, "invalid token");
        return;
      }
    }

    try {
      const engine = await ctx.worlds.ensureLoaded(planetId);
      const hello: RealtimeMessage = {
        kind: "hello",
        planetId,
        tick: engine.state.tick,
        year: engine.state.year,
      };
      socket.send(JSON.stringify(hello));
    } catch {
      socket.close(4404, "planet not found");
      return;
    }

    const unsubscribe = ctx.worlds.subscribe(planetId, (message) => {
      // user-targeted notifications only go to that user's sockets
      if (message.kind === "notification" && message.notification.userId !== userId) return;
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });

    ctx.tracker.track("ws_client_connected", { userId: userId ?? undefined, planetId });
    socket.on("close", () => {
      unsubscribe();
      ctx.tracker.track("ws_client_disconnected", { userId: userId ?? undefined, planetId });
    });
    socket.on("error", () => unsubscribe());
  });
}
