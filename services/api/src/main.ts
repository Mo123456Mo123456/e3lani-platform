import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { corsMiddleware, securityHeaders } from "./common/security.middleware";
import { runMigrations } from "./db/migrate";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");

  if ((process.env.MIGRATE_ON_BOOT ?? "true") === "true" && process.env.DATABASE_URL) {
    try {
      const applied = await runMigrations(process.env.DATABASE_URL);
      if (applied.length) logger.log(`applied migrations: ${applied.join(", ")}`);
    } catch (err) {
      logger.error(`migration failed: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["log", "warn", "error"],
  });

  app.use(json({ limit: "2mb" }));
  app.use(urlencoded({ extended: false, limit: "2mb" }));
  app.use(securityHeaders);
  app.use(
    corsMiddleware([
      process.env.WEB_URL ?? "http://localhost:3000",
      process.env.ADMIN_URL ?? "http://localhost:3001",
    ]),
  );
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // OpenAPI: hand-maintained spec served raw + a lightweight docs page
  const openapiCandidates = [
    join(__dirname, "..", "..", "..", "..", "docs", "openapi.yaml"),
    join(process.cwd(), "docs", "openapi.yaml"),
    join("/workspace", "docs", "openapi.yaml"),
  ];
  const openapiPath = openapiCandidates.find((p) => existsSync(p));
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get("/openapi.yaml", (_req: unknown, res: { setHeader: (k: string, v: string) => void; send: (b: string) => void }) => {
    res.setHeader("content-type", "text/yaml; charset=utf-8");
    res.send(openapiPath ? readFileSync(openapiPath, "utf8") : "# openapi spec not found in this deployment\n");
  });
  httpAdapter.get("/docs", (_req: unknown, res: { setHeader: (k: string, v: string) => void; send: (b: string) => void }) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.send(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>Planet Born API</title>
<style>body{font-family:system-ui;background:#050a16;color:#e6ecf7;display:flex;min-height:100vh;align-items:center;justify-content:center}
a{color:#38bdf8}</style></head><body><main>
<h1>واجهة برمجة «كوكب يولد أمامك»</h1>
<p>OpenAPI spec: <a href="/openapi.yaml">/openapi.yaml</a></p>
<p>Health: <a href="/health">/health</a> · Readiness: <a href="/ready">/ready</a></p>
<p>WebSocket: <code>/socket.io</code> (JWT auth, delta events only)</p>
</main></body></html>`);
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  logger.log(`API listening on :${port}`);
}

void bootstrap();
