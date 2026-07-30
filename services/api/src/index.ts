import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./routes/index.js";
import { worldRuntime, type BusMessage } from "./services/world-runtime.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(helmet, {
  contentSecurityPolicy: false,
});
await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
});
await app.register(swagger, {
  openapi: {
    info: {
      title: "كوكب يولد أمامك API",
      description:
        "Planet Born Before You — REST API for world state, contributions, simulation, and admin.",
      version: "0.1.0",
    },
    tags: [
      { name: "auth" },
      { name: "planet" },
      { name: "contributions" },
      { name: "simulation" },
      { name: "admin" },
    ],
  },
});
await app.register(swaggerUi, {
  routePrefix: "/docs",
});
await app.register(websocket);

type Client = { socket: { send: (data: string) => void; readyState: number }; userId?: string };
const clients = new Set<Client>();

app.get("/ws", { websocket: true }, (socket, req) => {
  const client: Client = { socket };
  clients.add(client);
  socket.send(
    JSON.stringify({
      type: "simulation.tick",
      payload: {
        tick: worldRuntime.engine?.state.tick ?? 0,
        year: worldRuntime.engine?.state.year ?? 0,
        eventsCount: 0,
      },
    }),
  );
  socket.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as { type: string; userId?: string };
      if (msg.type === "auth" && msg.userId) client.userId = msg.userId;
    } catch {
      /* ignore */
    }
  });
  socket.on("close", () => clients.delete(client));
});

function broadcast(msg: BusMessage) {
  const data = JSON.stringify(msg);
  for (const c of clients) {
    if (c.socket.readyState === 1) {
      if (
        msg.type === "notification" &&
        msg.payload.userId &&
        c.userId &&
        c.userId !== msg.payload.userId
      ) {
        continue;
      }
      c.socket.send(data);
    }
  }
}

await registerRoutes(app);

const port = Number(process.env.API_PORT ?? 4000);

try {
  console.log("Initializing world runtime…");
  await worldRuntime.init();
  worldRuntime.on("message", (msg: BusMessage) => broadcast(msg));
  worldRuntime.startAutotick();
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API listening on :${port}`);
  console.log(`OpenAPI docs at http://localhost:${port}/docs`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
