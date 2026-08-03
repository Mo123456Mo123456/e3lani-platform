import "dotenv/config";
import express, { type Request } from "express";
import { createServer } from "http";
import fs from "fs";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerPublicShareRoutes } from "../public-share-routes";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function normalizedOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function requestOrigin(req: Request): string {
  const protocol = req.protocol === "https" ? "https" : "http";
  return `${protocol}://${req.get("host")}`;
}

function configuredOrigins(): Set<string> {
  const values = [
    process.env.PUBLIC_APP_URL ?? "",
    ...(process.env.CORS_ALLOWED_ORIGINS ?? "").split(","),
  ];
  return new Set(values.map((value) => normalizedOrigin(value)).filter((value): value is string => Boolean(value)));
}

function startServer() {
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  const allowedOrigins = configuredOrigins();
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");

    const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    const origin = normalizedOrigin(originHeader);
    const sameOrigin = origin ? origin === requestOrigin(req) : true;
    const allowed = !origin || sameOrigin || allowedOrigins.has(origin);
    if (!allowed) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }

    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Visitor-Token",
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));

  registerStorageProxy(app);
  registerPublicShareRoutes(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      timestamp: Date.now(),
      capabilities: {
        database: Boolean(process.env.DATABASE_URL),
        storage: Boolean(process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY),
        mediaModeration: Boolean(process.env.MODERATION_PROVIDER_URL && process.env.MODERATION_PROVIDER_API_KEY),
        videoProcessing: Boolean(process.env.FFMPEG_PATH || process.platform !== "win32"),
      },
    });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  if (process.env.NODE_ENV === "production") {
    const webRoot = path.resolve(process.cwd(), "dist-web");
    const indexFile = path.join(webRoot, "index.html");
    if (fs.existsSync(indexFile)) {
      app.use(express.static(webRoot, { index: false, maxAge: "1h" }));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/") || req.path.startsWith("/share/") || req.path.startsWith("/manus-storage/")) {
          next();
          return;
        }
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.sendFile(indexFile);
      });
    } else {
      console.warn(`[web] Expo export not found at ${webRoot}; API-only mode is active`);
    }
  }

  const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);
  const isProduction = process.env.NODE_ENV === "production";
  const listen = async () => {
    const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);
    server.listen(port, "0.0.0.0", () => console.log(`[app] server listening on http://0.0.0.0:${port}`));
  };
  return listen();
}

startServer().catch((error) => {
  console.error("[app] failed to start", error);
  process.exitCode = 1;
});
