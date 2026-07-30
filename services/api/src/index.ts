import "dotenv/config";
import { createServer } from "node:http";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import {
  analyzedContributionSchema,
  contributionCommitSchema,
  contributionRequestSchema,
} from "@living-planet/shared-types";
import { analyzeContribution } from "./ai-client.js";
import { AuthService, requireRole } from "./auth.js";
import { WorldEventBus } from "./event-bus.js";
import { openApiDocument } from "./openapi.js";
import { createWorldRepository, type DeltaResult } from "./world-repository.js";

const app = express();
const server = createServer(app);
const websocketServer = new WebSocketServer({ noServer: true });
const auth = new AuthService();
const world = createWorldRepository();
const eventBus = new WorldEventBus();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (
  process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim());

const asyncRoute =
  (
    handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
  ): RequestHandler =>
  (request, response, next) => {
    void handler(request, response, next).catch(next);
  };

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("ORIGIN_NOT_ALLOWED"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: process.env.NODE_ENV === "production" ? 120 : 600,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use((request, response, next) => {
  const requestId = request.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
  response.setHeader("x-request-id", requestId);
  const start = performance.now();
  response.on("finish", () => {
    console.info(
      JSON.stringify({
        level: "info",
        requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      }),
    );
  });
  next();
});

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "living-planet-api",
    store: world.sandbox ? "sandbox-memory" : "postgres",
    time: new Date().toISOString(),
  });
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get("/openapi.json", (_request, response) => response.json(openApiDocument));

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
});

app.post(
  "/v1/auth/register",
  asyncRoute(async (request, response) => {
    const input = credentialsSchema
      .extend({ displayName: z.string().trim().min(2).max(80) })
      .parse(request.body);
    const user = await auth.register(input.email, input.password, input.displayName);
    response.status(201).json({ user });
  }),
);

app.post(
  "/v1/auth/login",
  asyncRoute(async (request, response) => {
    const input = credentialsSchema.parse(request.body);
    const session = await auth.login(input.email, input.password);
    response.cookie("planet_refresh", session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/v1/auth/refresh",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    response.json({ user: session.user, accessToken: session.accessToken });
  }),
);

app.post(
  "/v1/auth/refresh",
  asyncRoute(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      response.status(403).json({ error: "CSRF_ORIGIN_REJECTED" });
      return;
    }
    const cookies = Object.fromEntries(
      (request.headers.cookie ?? "")
        .split(";")
        .map((value) => value.trim().split("=").map(decodeURIComponent))
        .filter((parts) => parts.length === 2) as [string, string][],
    );
    const refreshToken = cookies.planet_refresh;
    if (!refreshToken) {
      response.status(401).json({ error: "REFRESH_TOKEN_REQUIRED" });
      return;
    }
    const session = await auth.rotateRefreshToken(refreshToken);
    response.cookie("planet_refresh", session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/v1/auth/refresh",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    response.json({ user: session.user, accessToken: session.accessToken });
  }),
);

app.get(
  "/v1/world/overview",
  asyncRoute(async (_request, response) => {
    response.json(await world.overview());
  }),
);

app.get(
  "/v1/simulation/snapshots/:tick",
  asyncRoute(async (request, response) => {
    const tick = z.coerce.number().int().nonnegative().parse(request.params.tick);
    const snapshot = await world.snapshot(tick);
    if (!snapshot) {
      response.status(404).json({ error: "SNAPSHOT_NOT_FOUND" });
      return;
    }
    response.json(snapshot);
  }),
);

app.post(
  "/v1/contributions/analyze",
  auth.middleware(),
  asyncRoute(async (request, response) => {
    const input = contributionRequestSchema.parse(request.body);
    response.json(await analyzeContribution(input));
  }),
);

app.post(
  "/v1/contributions/scenarios",
  auth.middleware(),
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        analysis: analyzedContributionSchema,
        regionId: z.string().uuid(),
      })
      .parse(request.body);
    response.json({
      outcomes: await world.project(input.analysis, input.regionId),
      probabilistic: true,
    });
  }),
);

async function broadcastDelta(result: DeltaResult): Promise<void> {
  const payload = JSON.stringify({
    type: "WORLD_DELTA",
    planetId: result.state.planetId,
    version: result.state.version,
    events: result.events.filter((event) => event.type !== "SIMULATION_TICK_COMPLETED"),
    changedRegionIds: result.changedRegionIds,
  });
  for (const client of websocketServer.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
  await eventBus.publish(result);
}

app.post(
  "/v1/contributions",
  auth.middleware(),
  asyncRoute(async (request, response) => {
    const input = contributionCommitSchema.parse(request.body);
    const result = await world.contribute(
      input.analysis,
      input.regionId,
      request.auth!.id,
      input.expectedPlanetVersion,
    );
    await broadcastDelta(result);
    response.status(201).json({
      contributionId: result.contributionId,
      version: result.state.version,
      events: result.events,
      causalLinks: result.causalLinks,
    });
  }),
);

app.post(
  "/v1/simulation/tick",
  auth.middleware(),
  asyncRoute(async (_request, response) => {
    const result = await world.tick();
    await broadcastDelta(result);
    response.json({
      tick: result.state.tick,
      year: result.state.year,
      version: result.state.version,
      events: result.events.filter((event) => event.type !== "SIMULATION_TICK_COMPLETED"),
      changedRegionIds: result.changedRegionIds,
    });
  }),
);

app.post(
  "/v1/simulation/pause",
  auth.middleware(),
  requireRole("simulation_admin", "admin", "super_admin"),
  asyncRoute(async (request, response) => {
    const { paused } = z.object({ paused: z.boolean() }).parse(request.body);
    const state = await world.pause(paused);
    response.json({ tick: state.tick, paused: state.paused, version: state.version });
  }),
);

app.post(
  "/v1/simulation/rollback",
  auth.middleware(),
  requireRole("simulation_admin", "admin", "super_admin"),
  asyncRoute(async (request, response) => {
    const { tick } = z.object({ tick: z.number().int().nonnegative() }).parse(request.body);
    const state = await world.rollback(tick);
    response.json({ tick: state.tick, year: state.year, version: state.version });
  }),
);

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  const token = url.searchParams.get("token");
  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  void auth
    .verifyAccessToken(token)
    .then((user) => {
      websocketServer.handleUpgrade(request, socket, head, (client) => {
        client.send(JSON.stringify({ type: "CONNECTED", userId: user.id }));
        websocketServer.emit("connection", client, request);
      });
    })
    .catch(() => {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    });
});

app.use(
  (
    error: unknown,
    request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const validation = error instanceof z.ZodError;
    const status =
      validation ? 400 : message === "WORLD_VERSION_CONFLICT" ? 409 : message.includes("NOT_FOUND") ? 404 : 400;
    console.error(
      JSON.stringify({
        level: "error",
        path: request.path,
        error: message,
        issues: validation ? error.issues : undefined,
      }),
    );
    response.status(status).json({
      error: validation ? "VALIDATION_ERROR" : message,
      issues: validation ? error.issues : undefined,
    });
  },
);

await Promise.all([auth.initialize(), world.initialize(), eventBus.connect()]);
server.listen(port, () => {
  console.info(
    JSON.stringify({
      level: "info",
      message: "living-planet-api listening",
      port,
      sandbox: world.sandbox,
      docs: `http://localhost:${port}/docs`,
    }),
  );
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void eventBus.close().finally(() => server.close(() => process.exit(0)));
  });
}
