import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const read = (path) => readFileSync(path, "utf8");
const write = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
};

function replaceExactly(path, before, after, expected = 1) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} exact match(es), found ${count}`);
  }
  write(path, source.replace(before, after));
}

write(
  "server/_core/cookies.ts",
  `import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  const values = Array.isArray(forwarded) ? forwarded : String(forwarded ?? "").split(",");
  return values.some((value) => value.trim().toLowerCase() === "https");
}

function configuredCookieDomain(req: Request): string | undefined {
  const configured = process.env.COOKIE_DOMAIN?.trim().replace(/^\\./, "").toLowerCase();
  if (!configured) return undefined;
  const hostname = req.hostname.toLowerCase();
  if (hostname !== configured && !hostname.endsWith(\`.\${configured}\`)) return undefined;
  return \`.\${configured}\`;
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    domain: configuredCookieDomain(req),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
`,
);

write(
  "server/_core/index.ts",
  `import "dotenv/config";
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
  throw new Error(\`No available port found starting from \${startPort}\`);
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
  return \`\${protocol}://\${req.get("host")}\`;
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
      app.use(express.static(webRoot, { index: "index.html", maxAge: "1h" }));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/") || req.path.startsWith("/share/") || req.path.startsWith("/manus-storage/")) {
          next();
          return;
        }
        res.sendFile(indexFile);
      });
    } else {
      console.warn(\`[web] Expo export not found at \${webRoot}; API-only mode is active\`);
    }
  }

  const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);
  const isProduction = process.env.NODE_ENV === "production";
  const listen = async () => {
    const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);
    server.listen(port, "0.0.0.0", () => console.log(\`[app] server listening on http://0.0.0.0:\${port}\`));
  };
  return listen();
}

startServer().catch((error) => {
  console.error("[app] failed to start", error);
  process.exitCode = 1;
});
`,
);

write(
  "server/video-processing.ts",
  `import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROCESS_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 120 * 1024 * 1024;
const FFMPEG = process.env.FFMPEG_PATH?.trim() || "/usr/bin/ffmpeg";
const FONT_FILE = process.env.VIDEO_FONT_PATH?.trim() || "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

export async function assertVideoProcessingAvailable(): Promise<void> {
  await access(FFMPEG, constants.X_OK).catch(() => {
    throw new Error("VIDEO_PROCESSING_UNAVAILABLE");
  });
  await access(FONT_FILE, constants.R_OK).catch(() => {
    throw new Error("VIDEO_FONT_UNAVAILABLE");
  });
}

async function runFfmpeg(args: string[]): Promise<void> {
  await assertVideoProcessingAvailable();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 8_000) stderr += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("VIDEO_PROCESSING_TIMEOUT"));
    }, PROCESS_TIMEOUT_MS);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("VIDEO_PROCESSING_UNAVAILABLE"));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr ? "VIDEO_PROCESSING_FAILED" : "VIDEO_PROCESSING_FAILED"));
    });
  });
}

async function withVideoWorkspace<T>(
  source: Buffer,
  operation: (paths: { input: string; output: string; watermark: string }) => Promise<T>,
): Promise<T> {
  if (!source.length || source.length > MAX_SOURCE_BYTES) throw new Error("VIDEO_SOURCE_SIZE_INVALID");
  const directory = await mkdtemp(join(tmpdir(), "e3lani-video-"));
  const paths = {
    input: join(directory, "input.mp4"),
    output: join(directory, "output.mp4"),
    watermark: join(directory, "watermark.txt"),
  };
  try {
    await writeFile(paths.input, source, { mode: 0o600 });
    return await operation(paths);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function createVideoPoster(source: Buffer): Promise<Buffer> {
  return withVideoWorkspace(source, async ({ input, output }) => {
    const poster = output.replace(/\\.mp4$/, ".jpg");
    await runFfmpeg([
      "-ss", "0.1", "-i", input, "-frames:v", "1",
      "-vf", "scale=1200:1200:force_original_aspect_ratio=decrease,pad=1200:1200:(ow-iw)/2:(oh-ih)/2:black",
      "-q:v", "3", poster,
    ]);
    const result = await readFile(poster);
    if (!result.length) throw new Error("VIDEO_POSTER_EMPTY");
    return result;
  });
}

export async function createWatermarkedShareVideo(source: Buffer, watermarkText: string): Promise<Buffer> {
  return withVideoWorkspace(source, async ({ input, output, watermark }) => {
    await writeFile(watermark, watermarkText.slice(0, 160), { encoding: "utf8", mode: 0o600 });
    const x = "if(lt(mod(t\\\\,8)\\\\,2)\\\\,24\\\\,if(lt(mod(t\\\\,8)\\\\,4)\\\\,w-tw-24\\\\,if(lt(mod(t\\\\,8)\\\\,6)\\\\,w-tw-24\\\\,24)))";
    const y = "if(lt(mod(t\\\\,8)\\\\,2)\\\\,24\\\\,if(lt(mod(t\\\\,8)\\\\,4)\\\\,24\\\\,if(lt(mod(t\\\\,8)\\\\,6)\\\\,h-th-24\\\\,h-th-24)))";
    const filter = [
      "scale=1080:1920:force_original_aspect_ratio=decrease",
      "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
      \`drawtext=fontfile=\${FONT_FILE}:textfile=\${watermark}:reload=0:fontcolor=white:fontsize=38:line_spacing=10:borderw=3:bordercolor=black@0.78:box=1:boxcolor=black@0.24:boxborderw=14:x='\${x}':y='\${y}'\`,
    ].join(",");
    await runFfmpeg([
      "-i", input, "-vf", filter, "-map", "0:v:0", "-map", "0:a?",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-threads", "2", output,
    ]);
    const result = await readFile(output);
    if (!result.length || result.length > MAX_OUTPUT_BYTES) throw new Error("VIDEO_OUTPUT_SIZE_INVALID");
    return result;
  });
}
`,
);

replaceExactly(
  "server/ads-service.ts",
  `  moderationCases,\n  reports,`,
  `  moderationCases,\n  profilePostMedia,\n  reports,`,
);

replaceExactly(
  "server/ads-service.ts",
  `async function resolveCityId(cityCode: string) {
  const db = requireDatabase(await getDb());
  const candidates = [cityCode];
  if (cityCode.startsWith("other") && cityCode !== "other") candidates.push("other");
  for (const code of candidates) {
    const rows = await db
      .select({ id: cities.id, code: cities.code })
      .from(cities)
      .where(and(eq(cities.code, code), eq(cities.isActive, 1)))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  const fallback = await db
    .select({ id: cities.id, code: cities.code })
    .from(cities)
    .where(eq(cities.isActive, 1))
    .orderBy(asc(cities.sortOrder))
    .limit(1);
  if (!fallback[0]) throw new Error("CITY_NOT_FOUND");
  return fallback[0];
}`,
  `async function resolveCityId(cityCode: string, countryCode: string) {
  const db = requireDatabase(await getDb());
  const normalizedCountry = countryCode.trim().toUpperCase();
  const candidates = [cityCode];
  if (cityCode.startsWith("other") && cityCode !== "other") candidates.push("other");
  for (const code of candidates) {
    const rows = await db
      .select({ id: cities.id, code: cities.code })
      .from(cities)
      .innerJoin(countries, eq(cities.countryId, countries.id))
      .where(
        and(
          eq(cities.code, code),
          eq(cities.isActive, 1),
          eq(countries.code, normalizedCountry),
          eq(countries.isActive, 1),
        ),
      )
      .limit(1);
    if (rows[0]) return rows[0];
  }
  throw new Error("CITY_NOT_FOUND_FOR_COUNTRY");
}`,
);
replaceExactly("server/ads-service.ts", `const city = await resolveCityId(input.cityCode);`, `const city = await resolveCityId(input.cityCode, input.countryCode);`);

replaceExactly(
  "server/ads-service.ts",
  `      deletedAt: input.status === "removed" ? now : null,
      activatedAt: input.status === "active" ? adRows[0].activatedAt ?? now : adRows[0].activatedAt,`,
  `      deletedAt: input.status === "removed" ? now : null,
      activatedAt: input.status === "active" ? adRows[0].activatedAt ?? now : adRows[0].activatedAt,
      adminHold: input.status === "active" ? 0 : 1,
      adminHoldReason: input.status === "active" ? null : input.reason?.trim().slice(0, 500) || "Administrative hold",
      moderationStatus: input.status === "active" ? "approved" : adRows[0].moderationStatus,`,
);
replaceExactly(
  "server/ads-service.ts",
  `    beforeState: { adStatus: adRows[0].adStatus },
    afterState: { adStatus: input.status },`,
  `    beforeState: { adStatus: adRows[0].adStatus, adminHold: adRows[0].adminHold },
    afterState: { adStatus: input.status, adminHold: input.status === "active" ? 0 : 1 },`,
);
replaceExactly(
  "server/ads-service.ts",
  `  if (ad.paymentStatus === "pending") throw new Error("AD_AWAITING_PAYMENT");
  if (ad.moderationStatus === "rejected") throw new Error("AD_MODERATION_REJECTED");`,
  `  if (ad.paymentStatus === "pending") throw new Error("AD_AWAITING_PAYMENT");
  if (ad.adminHold === 1) throw new Error("AD_ADMIN_HOLD");
  if (ad.moderationStatus === "rejected") throw new Error("AD_MODERATION_REJECTED");`,
);

replaceExactly(
  "server/ads-service.ts",
  `  const now = new Date();
  const insertRev = await db.insert(adRevisions).values({`,
  `  const policy = await loadLaunchPolicy();
  const scan = policy.aiModeration
    ? scanAdContent({ title, description })
    : { label: "SAFE" as const, reasons: [], autoAction: "keep_published" as const, confidence: 0 };
  const reviewStatus =
    scan.autoAction === "auto_pause"
      ? "rejected"
      : scan.autoAction === "flag_for_admin"
        ? "queued"
        : "approved";
  const now = new Date();
  const insertRev = await db.insert(adRevisions).values({`,
  1,
);
replaceExactly(
  "server/ads-service.ts",
  `    reviewStatus: "approved",
    submittedAt: now,
    decidedAt: now,`,
  `    reviewStatus,
    submittedAt: now,
    decidedAt: reviewStatus === "approved" || reviewStatus === "rejected" ? now : null,
    decisionReason: scan.reasons.join(", ") || null,`,
  1,
);
replaceExactly(
  "server/ads-service.ts",
  `  await db.update(ads).set({ currentRevisionId: revisionId }).where(eq(ads.id, ad.id));`,
  `  const nextAdStatus = scan.autoAction === "auto_pause" ? "paused" : ad.adStatus;
  const nextModerationStatus =
    scan.autoAction === "auto_pause"
      ? "rejected"
      : scan.autoAction === "flag_for_admin"
        ? "queued"
        : ad.adminHold === 1
          ? ad.moderationStatus
          : "approved";
  await db
    .update(ads)
    .set({
      currentRevisionId: revisionId,
      adStatus: nextAdStatus,
      moderationStatus: nextModerationStatus,
      pausedAt: nextAdStatus === "paused" ? ad.pausedAt ?? now : ad.pausedAt,
    })
    .where(eq(ads.id, ad.id));
  if (scan.autoAction !== "keep_published") {
    await db.insert(moderationCases).values({
      adId: ad.id,
      revisionId,
      status: scan.autoAction === "auto_pause" ? "rejected" : "queued",
      riskScore: Math.round(scan.confidence * 100),
      automatedSignals: { source: "edited_text", ...scan },
      decisionReason: scan.reasons.join(", ") || null,
      decidedAt: scan.autoAction === "auto_pause" ? now : null,
    });
  }`,
  1,
);

replaceExactly(
  "server/ads-service.ts",
  `  const linked = await db.select({ mediaAssetId: adMedia.mediaAssetId }).from(adMedia);
  const linkedIds = [...new Set(linked.map((row) => row.mediaAssetId))];`,
  `  const [adLinks, postLinks] = await Promise.all([
    db.select({ mediaAssetId: adMedia.mediaAssetId }).from(adMedia),
    db.select({ mediaAssetId: profilePostMedia.mediaAssetId }).from(profilePostMedia),
  ]);
  const linkedIds = [...new Set([...adLinks, ...postLinks].map((row) => row.mediaAssetId))];`,
);

replaceExactly(
  "server/content-identity.ts",
  `export async function findIdempotentAction(
  tx: any,
  idempotencyKey: string,
  actionType: "main_ad" | "profile_post" | "report",
) {
  const rows = await tx
    .select({
      contentPublicId: identityActionEvents.contentPublicId,
      actionType: identityActionEvents.actionType,
    })
    .from(identityActionEvents)
    .where(eq(identityActionEvents.idempotencyKey, idempotencyKey))
    .limit(1);`,
  `export async function findIdempotentAction(
  tx: any,
  identity: ContentIdentity,
  idempotencyKey: string,
  actionType: "main_ad" | "profile_post" | "report",
) {
  const ownerCondition =
    identity.kind === "user"
      ? eq(identityActionEvents.userId, identity.userId)
      : eq(identityActionEvents.visitorSessionId, identity.visitorSessionId);
  const rows = await tx
    .select({
      contentPublicId: identityActionEvents.contentPublicId,
      actionType: identityActionEvents.actionType,
    })
    .from(identityActionEvents)
    .where(
      and(
        ownerCondition,
        eq(identityActionEvents.actionType, actionType),
        eq(identityActionEvents.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);`,
);
replaceExactly("server/ads-service.ts", `findIdempotentAction(tx, input.idempotencyKey,`, `findIdempotentAction(tx, input.identity, input.idempotencyKey,`, 2);
replaceExactly("server/profile-service.ts", `findIdempotentAction(tx, input.idempotencyKey,`, `findIdempotentAction(tx, input.identity, input.idempotencyKey,`, 2);

replaceExactly(
  "server/profile-service.ts",
  `  profileFollows,
  profilePostMedia,`,
  `  profileFollows,
  profilePostEvents,
  profilePostMedia,`,
);
replaceExactly(
  "server/profile-service.ts",
  `export async function updateProfilePost(
  identity: ContentIdentity,
  input: { id: string; title?: string; description?: string },
) {
  const db = requireDatabase(await getDb());
  const post = await requireOwnedPost(identity, input.id);
  await db
    .update(profilePosts)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim().slice(0, 160) } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    })
    .where(eq(profilePosts.id, post.id));
  const rows = await db.select().from(profilePosts).where(eq(profilePosts.id, post.id)).limit(1);
  return (await mapPosts(rows, identity))[0];
}`,
  `export async function updateProfilePost(
  identity: ContentIdentity,
  input: { id: string; title?: string; description?: string },
) {
  const db = requireDatabase(await getDb());
  const post = await requireOwnedPost(identity, input.id);
  const title = (input.title ?? post.title).trim().slice(0, 160);
  const description = (input.description ?? post.description).trim();
  if (!title || !description) throw new Error("PROFILE_POST_CONTENT_INVALID");
  const policy = await loadLaunchPolicy();
  const scan = policy.aiModeration
    ? scanAdContent({ title, description })
    : { autoAction: "keep_published" as const, reasons: [], confidence: 0, label: "SAFE" as const };
  const severe = scan.autoAction === "auto_pause";
  const wasEnforced = post.postStatus === "paused" && post.moderationStatus === "rejected";
  await db
    .update(profilePosts)
    .set({
      title,
      description,
      postStatus: severe ? "paused" : post.postStatus,
      moderationStatus: severe
        ? "rejected"
        : wasEnforced || scan.autoAction === "flag_for_admin"
          ? "queued"
          : "approved",
    })
    .where(eq(profilePosts.id, post.id));
  if (scan.autoAction !== "keep_published" || wasEnforced) {
    await db.insert(moderationCases).values({
      profilePostId: post.id,
      status: severe ? "rejected" : "queued",
      riskScore: Math.round(scan.confidence * 100),
      automatedSignals: { source: "edited_text", ...scan },
      decisionReason: scan.reasons.join(", ") || (wasEnforced ? "edited_enforced_post" : null),
      decidedAt: severe ? new Date() : null,
    });
  }
  const rows = await db.select().from(profilePosts).where(eq(profilePosts.id, post.id)).limit(1);
  return (await mapPosts(rows, identity))[0];
}`,
);
replaceExactly(
  "server/profile-service.ts",
  `export async function recordProfilePostEvent(
  publicPostId: string,
  eventType: "view" | "share",
) {
  const db = requireDatabase(await getDb());
  const column = eventType === "view" ? profilePosts.views : profilePosts.shares;
  await db
    .update(profilePosts)
    .set({ [eventType === "view" ? "views" : "shares"]: sql\`\${column} + 1\` })
    .where(and(eq(profilePosts.publicId, publicPostId), eq(profilePosts.postStatus, "active")));
  return { ok: true as const };
}`,
  `export async function recordProfilePostEvent(
  publicPostId: string,
  eventType: "view" | "share",
  dedupeKey: string,
) {
  const db = requireDatabase(await getDb());
  const posts = await db
    .select({ id: profilePosts.id })
    .from(profilePosts)
    .where(and(eq(profilePosts.publicId, publicPostId), eq(profilePosts.postStatus, "active")))
    .limit(1);
  if (!posts[0]) throw new Error("PROFILE_POST_NOT_FOUND");
  try {
    await db.insert(profilePostEvents).values({
      profilePostId: posts[0].id,
      eventType,
      dedupeKey: dedupeKey.slice(0, 180),
    });
  } catch {
    return { ok: true as const, deduped: true as const };
  }
  const column = eventType === "view" ? profilePosts.views : profilePosts.shares;
  await db
    .update(profilePosts)
    .set({ [eventType === "view" ? "views" : "shares"]: sql\`\${column} + 1\` })
    .where(eq(profilePosts.id, posts[0].id));
  return { ok: true as const, deduped: false as const };
}`,
);
replaceExactly(
  "server/routers.ts",
  `      .mutation(async ({ input }) => {
        try {
          return await recordProfilePostEvent(input.id, input.eventType);
        } catch (error) {
          return mapServiceError(error);
        }
      }),`,
  `      .mutation(async ({ ctx, input }) => {
        try {
          const actor = ctx.user
            ? \`user:\${ctx.user.id}\`
            : ctx.visitor
              ? \`visitor:\${ctx.visitor.id}\`
              : \`ip:\${ctx.req.ip || "unknown"}\`;
          const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
          return await recordProfilePostEvent(
            input.id,
            input.eventType,
            \`\${input.id}:\${input.eventType}:\${actor}:\${bucket}\`,
          );
        } catch (error) {
          return mapServiceError(error);
        }
      }),`,
  1,
);

replaceExactly(
  "drizzle/schema/content.ts",
  `  moderationStatus: mysqlEnum("moderationStatus", ["not_submitted", "queued", "in_review", "approved", "changes_requested", "rejected"]).default("not_submitted").notNull(),
  activatedAt: timestamp("activatedAt"),`,
  `  moderationStatus: mysqlEnum("moderationStatus", ["not_submitted", "queued", "in_review", "approved", "changes_requested", "rejected"]).default("not_submitted").notNull(),
  adminHold: tinyint("adminHold").default(0).notNull(),
  adminHoldReason: varchar("adminHoldReason", { length: 500 }),
  activatedAt: timestamp("activatedAt"),`,
);
replaceExactly(
  "drizzle/schema/community.ts",
  `  uniqueIndex("identity_action_idempotency_unique").on(table.idempotencyKey),
  index("identity_action_user_window_idx").on(table.userId, table.actionType, table.createdAt),`,
  `  uniqueIndex("identity_action_user_idempotency_unique").on(table.userId, table.actionType, table.idempotencyKey),
  uniqueIndex("identity_action_visitor_idempotency_unique").on(table.visitorSessionId, table.actionType, table.idempotencyKey),
  index("identity_action_user_window_idx").on(table.userId, table.actionType, table.createdAt),`,
);
replaceExactly(
  "drizzle/schema/community.ts",
  `export const profileFollows = mysqlTable("profile_follows", {`,
  `export const profilePostEvents = mysqlTable("profile_post_events", {
  id: int("id").autoincrement().primaryKey(),
  profilePostId: int("profilePostId").notNull().references(() => profilePosts.id),
  eventType: mysqlEnum("eventType", ["view", "share"]).notNull(),
  dedupeKey: varchar("dedupeKey", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("profile_post_events_dedupe_unique").on(table.dedupeKey),
  index("profile_post_events_rollup_idx").on(table.profilePostId, table.eventType, table.createdAt),
]);

export const profileFollows = mysqlTable("profile_follows", {`,
);

write(
  "server/media-moderation-service.ts",
  `import { and, eq, inArray } from "drizzle-orm";

import {
  adMedia,
  adRevisions,
  ads,
  mediaAssets,
  moderationCases,
  profilePostMedia,
  profilePosts,
} from "../drizzle/schema";
import { getDb, requireDatabase } from "./db";
import { storageGetSignedUrl } from "./storage";

type ProviderDecision = {
  decision: "safe" | "review" | "block" | "not_configured" | "failed";
  confidence: number;
  reasons: string[];
};

function providerEndpoint(): URL | null {
  const raw = process.env.MODERATION_PROVIDER_URL?.trim();
  if (!raw) return null;
  try {
    const endpoint = new URL(raw);
    if (endpoint.protocol !== "https:" && process.env.NODE_ENV === "production") return null;
    const allowed = (process.env.MODERATION_PROVIDER_HOSTS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(endpoint.hostname.toLowerCase())) return null;
    return endpoint;
  } catch {
    return null;
  }
}

async function providerDecision(
  assets: { storageKey: string; mediaType: "image" | "video"; mimeType: string }[],
): Promise<ProviderDecision> {
  const endpoint = providerEndpoint();
  const apiKey = process.env.MODERATION_PROVIDER_API_KEY?.trim();
  if (!endpoint || !apiKey) return { decision: "not_configured", confidence: 0, reasons: ["media_provider_not_configured"] };
  const urls = await Promise.all(
    assets.slice(0, 10).map(async (asset) => ({
      type: asset.mediaType,
      mimeType: asset.mimeType,
      url: await storageGetSignedUrl(asset.storageKey),
    })),
  );
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: \`Bearer \${apiKey}\`, "Content-Type": "application/json" },
      body: JSON.stringify({ assets: urls }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return { decision: "failed", confidence: 0, reasons: ["media_provider_http_failure"] };
    const payload = (await response.json()) as Record<string, unknown>;
    const decision = payload.decision === "safe" || payload.decision === "review" || payload.decision === "block" ? payload.decision : "failed";
    const confidence = typeof payload.confidence === "number" ? Math.min(1, Math.max(0, payload.confidence)) : 0;
    const reasons = Array.isArray(payload.reasons)
      ? payload.reasons.filter((reason): reason is string => typeof reason === "string").slice(0, 20)
      : [];
    return { decision, confidence, reasons };
  } catch {
    return { decision: "failed", confidence: 0, reasons: ["media_provider_request_failed"] };
  }
}

async function queueAdCase(input: { adId: number; revisionId: number; reason: string; riskScore?: number }) {
  const db = requireDatabase(await getDb());
  const open = await db
    .select({ id: moderationCases.id })
    .from(moderationCases)
    .where(and(eq(moderationCases.adId, input.adId), inArray(moderationCases.status, ["queued", "in_review"])))
    .limit(1);
  if (!open[0]) {
    await db.insert(moderationCases).values({
      adId: input.adId,
      revisionId: input.revisionId,
      status: "queued",
      riskScore: input.riskScore ?? 25,
      automatedSignals: { source: "media_provider", result: input.reason },
      decisionReason: input.reason,
    });
  }
  await db.update(ads).set({ moderationStatus: "queued" }).where(eq(ads.id, input.adId));
}

export async function moderateAdMediaAfterPublish(publicAdId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({
      adId: ads.id,
      revisionId: adRevisions.id,
      storageKey: mediaAssets.storageKey,
      mediaType: mediaAssets.mediaType,
      mimeType: mediaAssets.mimeType,
    })
    .from(ads)
    .innerJoin(adRevisions, eq(ads.currentRevisionId, adRevisions.id))
    .innerJoin(adMedia, eq(adMedia.revisionId, adRevisions.id))
    .innerJoin(mediaAssets, eq(adMedia.mediaAssetId, mediaAssets.id))
    .where(eq(ads.publicId, publicAdId));
  if (!rows.length) return { decision: "safe" as const, configured: true };
  const scan = await providerDecision(rows);
  if (scan.decision === "not_configured" || scan.decision === "failed") {
    await queueAdCase({ adId: rows[0].adId, revisionId: rows[0].revisionId, reason: scan.reasons[0] ?? scan.decision });
    return { decision: scan.decision, configured: scan.decision !== "not_configured" };
  }
  if (scan.decision === "review" || scan.decision === "block") {
    await db.insert(moderationCases).values({
      adId: rows[0].adId,
      revisionId: rows[0].revisionId,
      status: scan.decision === "block" ? "rejected" : "queued",
      riskScore: Math.round(scan.confidence * 100),
      automatedSignals: { source: "media_provider", ...scan },
      decisionReason: scan.reasons.join(", ") || null,
      decidedAt: scan.decision === "block" ? new Date() : null,
    });
    await db
      .update(ads)
      .set({
        adStatus: scan.decision === "block" ? "paused" : "active",
        moderationStatus: scan.decision === "block" ? "rejected" : "queued",
        pausedAt: scan.decision === "block" ? new Date() : null,
      })
      .where(eq(ads.id, rows[0].adId));
  }
  return { decision: scan.decision, configured: true };
}

export async function moderateProfilePostMediaAfterPublish(publicPostId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({
      postId: profilePosts.id,
      storageKey: mediaAssets.storageKey,
      mediaType: mediaAssets.mediaType,
      mimeType: mediaAssets.mimeType,
    })
    .from(profilePosts)
    .innerJoin(profilePostMedia, eq(profilePostMedia.profilePostId, profilePosts.id))
    .innerJoin(mediaAssets, eq(profilePostMedia.mediaAssetId, mediaAssets.id))
    .where(eq(profilePosts.publicId, publicPostId));
  if (!rows.length) return { decision: "safe" as const, configured: true };
  const scan = await providerDecision(rows);
  if (scan.decision !== "safe") {
    await db.insert(moderationCases).values({
      profilePostId: rows[0].postId,
      status: scan.decision === "block" ? "rejected" : "queued",
      riskScore: scan.decision === "failed" || scan.decision === "not_configured" ? 25 : Math.round(scan.confidence * 100),
      automatedSignals: { source: "media_provider", ...scan },
      decisionReason: scan.reasons.join(", ") || scan.decision,
      decidedAt: scan.decision === "block" ? new Date() : null,
    });
    await db
      .update(profilePosts)
      .set({
        postStatus: scan.decision === "block" ? "paused" : "active",
        moderationStatus: scan.decision === "block" ? "rejected" : "queued",
      })
      .where(eq(profilePosts.id, rows[0].postId));
  }
  return { decision: scan.decision, configured: scan.decision !== "not_configured" };
}
`,
);

write(
  "components/screen-container.tsx",
  `import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
}

export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  return (
    <View className={cn("flex-1", "bg-background", containerClassName)} {...props}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.watermark}>
        <Text style={styles.watermarkMark}>إ</Text>
        <Text style={styles.watermarkName}>إعلاني | E3lani</Text>
      </View>
      <SafeAreaView edges={edges} className={cn("flex-1", safeAreaClassName)} style={style}>
        <View className={cn("flex-1", className)}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  watermark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.028,
    transform: [{ rotate: "-18deg" }],
  },
  watermarkMark: { color: "#111111", fontSize: 132, lineHeight: 142, fontWeight: "900" },
  watermarkName: { color: "#111111", fontSize: 22, lineHeight: 30, fontWeight: "900", letterSpacing: 0.4 },
});
`,
);

write(
  "components/e3lani/app-state-gate.tsx",
  `import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { normalizeLaunchPolicy } from "@/lib/launch-policy";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useProductData } from "@/lib/use-product-data";
import { getVisitorToken, setVisitorToken } from "@/lib/_core/auth";

function LaunchPolicyHydrator() {
  const { hydrateLaunchPolicy } = useE3lani();
  const productData = useProductData();
  useEffect(() => {
    if (productData.launchPolicy) hydrateLaunchPolicy(normalizeLaunchPolicy(productData.launchPolicy));
  }, [hydrateLaunchPolicy, productData.launchPolicy]);
  return null;
}

function LoadingState({ locale, label }: { locale: "ar" | "en"; label?: string }) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.04, duration: 650, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.9, duration: 650, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, scale]);
  return (
    <SafeAreaView style={styles.safeArea} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.logo, { opacity, transform: [{ scale }] }]}>
        <Text style={styles.logoLetter}>إ</Text>
      </Animated.View>
      <Text style={styles.brand}>إعلاني | E3lani</Text>
      <ActivityIndicator size="small" color={BRAND.yellowDark} />
      <Text style={styles.body}>{label ?? (locale === "ar" ? "جارٍ تجهيز تجربتك بأمان" : "Preparing your secure experience")}</Text>
    </SafeAreaView>
  );
}

function VisitorIdentityBoundary({ children }: { children: ReactNode }) {
  const store = useE3lani();
  const { locale } = useI18n();
  const ensure = trpc.visitor.ensure.useMutation();
  const upsert = trpc.visitor.upsert.useMutation();
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    if (!store.ready || store.loadError || identityReady || ensure.isPending) return;
    let active = true;
    void (async () => {
      const current = await getVisitorToken();
      const result = await ensure.mutateAsync();
      if (result.token !== current) await setVisitorToken(result.token);
      if (active) setIdentityReady(true);
    })().catch(() => undefined);
    return () => { active = false; };
  }, [ensure, identityReady, store.loadError, store.ready]);

  useEffect(() => {
    if (!store.ready || store.loadError || !identityReady) return;
    const timer = setTimeout(() => {
      upsert.mutate({
        prefs: {
          accountCountry: store.accountCountry,
          marketCode: String(store.marketCode),
          forceCountryFilter: store.forceCountryFilter,
          categoryFilter: store.categoryFilter,
          countryGateCompleted: store.countryGateCompleted,
          blockedOwners: store.blockedOwners.slice(0, 500),
        },
        savedAdPublicIds: store.savedIds.slice(0, 200),
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [identityReady, store.accountCountry, store.blockedOwners, store.categoryFilter, store.countryGateCompleted, store.forceCountryFilter, store.loadError, store.marketCode, store.ready, store.savedIds, upsert]);

  if (!identityReady) return <LoadingState locale={locale} />;
  return <>{children}</>;
}

export function AppStateGate({ children }: { children: ReactNode }) {
  const { ready, loadError, retryLoad, continueWithFreshState, countryGateCompleted } = useE3lani();
  const { locale } = useI18n();
  const pathname = usePathname();

  if (!ready) return <LoadingState locale={locale} label={locale === "ar" ? "نستعيد بياناتك المحفوظة على هذا الجهاز" : "Restoring data saved on this device"} />;

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea} accessibilityLiveRegion="assertive">
        <View style={styles.stateCard}>
          <View style={styles.iconCircle}><MaterialIcons name="sync-problem" size={34} color={BRAND.black} /></View>
          <Text style={styles.title}>{locale === "ar" ? "تعذر استعادة البيانات" : "Could not restore data"}</Text>
          <Text style={styles.body}>{locale === "ar" ? "تحقق من مساحة التخزين ثم أعد المحاولة، أو تابع ببيانات محلية جديدة." : "Check device storage and retry, or continue with fresh local data."}</Text>
          <Pressable accessibilityRole="button" onPress={retryLoad} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <MaterialIcons name="refresh" size={21} color={BRAND.black} /><Text style={styles.primaryLabel}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={continueWithFreshState} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryLabel}>{locale === "ar" ? "المتابعة ببيانات جديدة" : "Continue with fresh data"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const allowWithoutGate = pathname === "/welcome" || pathname === "/login" || pathname?.startsWith("/policies") || pathname?.startsWith("/oauth");
  return (
    <VisitorIdentityBoundary>
      <LaunchPolicyHydrator />
      {!countryGateCompleted && !allowWithoutGate ? <Redirect href="/welcome" /> : children}
    </VisitorIdentityBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  logo: { width: 96, height: 96, borderRadius: 30, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, elevation: 8 },
  logoLetter: { color: BRAND.black, fontSize: 57, lineHeight: 70, fontWeight: "900" },
  brand: { marginTop: 16, marginBottom: 14, color: BRAND.black, fontSize: 22, lineHeight: 30, fontWeight: "900" },
  stateCard: { width: "100%", maxWidth: 430, alignItems: "center", borderWidth: 1, borderColor: BRAND.border, borderRadius: 28, backgroundColor: BRAND.surface, paddingHorizontal: 24, paddingVertical: 32 },
  iconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 18, color: BRAND.black, fontSize: 21, lineHeight: 29, fontWeight: "900", textAlign: "center" },
  body: { marginTop: 8, color: BRAND.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  primaryButton: { width: "100%", minHeight: 52, marginTop: 22, borderRadius: 16, backgroundColor: BRAND.yellow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryLabel: { color: BRAND.black, fontSize: 15, lineHeight: 21, fontWeight: "900" },
  secondaryButton: { width: "100%", minHeight: 48, marginTop: 10, borderWidth: 1, borderColor: BRAND.border, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  secondaryLabel: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
});
`,
);

replaceExactly(
  "server/public-share-routes.ts",
  `<body><main><img src="\${html(image)}" alt="\${html(ad.title)}"/><h1>\${html(ad.title)}</h1><p>\${html(description)}</p><a href="e3lani://ad/\${html(ad.publicId)}">فتح الإعلان في إعلاني</a></main></body>`,
  `<body><main><img src="\${html(image)}" alt="\${html(ad.title)}"/><h1>\${html(ad.title)}</h1><p>\${html(description)}</p><a href="e3lani://ad/\${html(ad.publicId)}">فتح في التطبيق</a><a href="\${html(origin)}/ad/\${html(ad.publicId)}" style="margin-inline-start:10px;background:#fff">فتح في المتصفح</a></main></body>`,
);

write(
  "drizzle/0011_production_safety_hardening.sql",
  `ALTER TABLE \`ads\`
  ADD \`adminHold\` tinyint NOT NULL DEFAULT 0,
  ADD \`adminHoldReason\` varchar(500);

ALTER TABLE \`identity_action_events\`
  DROP INDEX \`identity_action_idempotency_unique\`,
  ADD CONSTRAINT \`identity_action_user_idempotency_unique\` UNIQUE (\`userId\`,\`actionType\`,\`idempotencyKey\`),
  ADD CONSTRAINT \`identity_action_visitor_idempotency_unique\` UNIQUE (\`visitorSessionId\`,\`actionType\`,\`idempotencyKey\`);

CREATE TABLE \`profile_post_events\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`profilePostId\` int NOT NULL,
  \`eventType\` enum('view','share') NOT NULL,
  \`dedupeKey\` varchar(180) NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`profile_post_events_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`profile_post_events_dedupe_unique\` UNIQUE(\`dedupeKey\`)
);
ALTER TABLE \`profile_post_events\`
  ADD CONSTRAINT \`profile_post_events_post_fk\`
  FOREIGN KEY (\`profilePostId\`) REFERENCES \`profile_posts\`(\`id\`) ON DELETE no action ON UPDATE no action;
CREATE INDEX \`profile_post_events_rollup_idx\` ON \`profile_post_events\` (\`profilePostId\`,\`eventType\`,\`createdAt\`);
`,
);

const journalPath = "drizzle/meta/_journal.json";
const journal = JSON.parse(read(journalPath));
if (!journal.entries.some((entry) => entry.tag === "0011_production_safety_hardening")) {
  journal.entries.push({ idx: 11, version: "5", when: 1785790800000, tag: "0011_production_safety_hardening", breakpoints: true });
}
write(journalPath, JSON.stringify(journal, null, 2));

write(
  "scripts/verify-production-schema.mjs",
  `import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const apply = process.argv.includes("--apply");

function splitSql(sql) {
  const result = [];
  let current = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    if (lineComment) {
      if (char === "\\n") { lineComment = false; current += char; }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") { blockComment = false; i += 1; }
      continue;
    }
    if (!quote && char === "-" && next === "-") { lineComment = true; i += 1; continue; }
    if (!quote && char === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (quote) {
      current += char;
      if (char === "\\\\") { current += sql[i + 1] ?? ""; i += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "\`") { quote = char; current += char; continue; }
    if (char === ";") {
      if (current.trim()) result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

const connection = await mysql.createConnection(databaseUrl);
const schemaName = new URL(databaseUrl).pathname.replace(/^\\//, "");

async function tableExists(name) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1",
    [schemaName, name],
  );
  return rows.length > 0;
}
async function columnExists(table, column) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1",
    [schemaName, table, column],
  );
  return rows.length > 0;
}
async function indexExists(table, indexName) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1",
    [schemaName, table, indexName],
  );
  return rows.length > 0;
}
async function runMigration(path, tag) {
  const sql = await readFile(path, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  for (const statement of splitSql(sql)) await connection.query(statement);
  await connection.query(
    "INSERT INTO e3lani_deploy_migrations (tag, checksum, appliedAt) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), appliedAt = VALUES(appliedAt)",
    [tag, checksum],
  );
}

try {
  const [lockRows] = await connection.query("SELECT GET_LOCK('e3lani-production-schema', 60) AS acquired");
  if (Number(lockRows[0]?.acquired) !== 1) throw new Error("SCHEMA_LOCK_TIMEOUT");
  await connection.query(
    "CREATE TABLE IF NOT EXISTS e3lani_deploy_migrations (tag varchar(120) PRIMARY KEY, checksum varchar(64) NOT NULL, appliedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );

  const baseTables = ["users", "visitor_sessions", "ads", "media_assets", "favorites", "reports", "moderation_cases", "audit_logs", "report_actions"];
  for (const table of baseTables) if (!(await tableExists(table))) throw new Error(\`BASE_SCHEMA_MISSING:\${table}\`);

  const state0010 = [
    await tableExists("advertiser_profiles"),
    await tableExists("profile_posts"),
    await tableExists("share_media_variants"),
    await columnExists("visitor_sessions", "status"),
    await columnExists("ads", "ownerVisitorSessionId"),
  ];
  const count0010 = state0010.filter(Boolean).length;
  if (count0010 === 0) {
    if (!apply) throw new Error("MIGRATION_0010_REQUIRED");
    await runMigration("drizzle/0010_guest_profiles_posts_sharing.sql", "0010_guest_profiles_posts_sharing");
  } else if (count0010 !== state0010.length) {
    throw new Error("MIGRATION_0010_PARTIAL_STATE");
  }

  const state0011 = [
    await columnExists("ads", "adminHold"),
    await columnExists("ads", "adminHoldReason"),
    await tableExists("profile_post_events"),
    await indexExists("identity_action_events", "identity_action_user_idempotency_unique"),
    await indexExists("identity_action_events", "identity_action_visitor_idempotency_unique"),
  ];
  const count0011 = state0011.filter(Boolean).length;
  if (count0011 === 0) {
    if (!apply) throw new Error("MIGRATION_0011_REQUIRED");
    await runMigration("drizzle/0011_production_safety_hardening.sql", "0011_production_safety_hardening");
  } else if (count0011 !== state0011.length) {
    throw new Error("MIGRATION_0011_PARTIAL_STATE");
  }

  console.log("[schema] production schema verified");
} finally {
  await connection.query("SELECT RELEASE_LOCK('e3lani-production-schema')").catch(() => undefined);
  await connection.end();
}
`,
);

write(
  "scripts/production-start.mjs",
  `import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";

const required = ["DATABASE_URL", "JWT_SECRET", "VITE_APP_ID"];
for (const key of required) if (!process.env[key]?.trim()) throw new Error(\`PRODUCTION_ENV_MISSING:\${key}\`);
if (process.env.REQUIRE_MEDIA_STORAGE !== "false") {
  for (const key of ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"]) {
    if (!process.env[key]?.trim()) throw new Error(\`PRODUCTION_ENV_MISSING:\${key}\`);
  }
}
const ffmpeg = process.env.FFMPEG_PATH?.trim() || "/usr/bin/ffmpeg";
await access(ffmpeg, constants.X_OK).catch(() => { throw new Error("FFMPEG_NOT_AVAILABLE"); });

await new Promise((resolve, reject) => {
  const migration = spawn(process.execPath, ["scripts/verify-production-schema.mjs", "--apply"], { stdio: "inherit", env: process.env });
  migration.once("error", reject);
  migration.once("exit", (code) => code === 0 ? resolve() : reject(new Error(\`SCHEMA_VERIFICATION_FAILED:\${code}\`)));
});

const app = spawn(process.execPath, ["dist/index.js"], { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => app.kill(signal));
app.once("error", (error) => { throw error; });
app.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
`,
);

write(
  "Dockerfile",
  `FROM node:22-bookworm-slim

RUN apt-get update \\
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \\
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV CI=true \\
    EXPO_NO_TELEMETRY=1 \\
    FFMPEG_PATH=/usr/bin/ffmpeg \\
    VIDEO_FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:render

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "scripts/production-start.mjs"]
`,
);
write(
  ".dockerignore",
  `.git
.github
node_modules
dist
dist-web
.expo
.env
.env.*
*.log
coverage
`,
);

write(
  "render.yaml",
  `services:
  - type: web
    name: e3lani-live
    runtime: docker
    plan: free
    region: frankfurt
    branch: cursor/global-free-launch-0f65
    autoDeployTrigger: checksPass
    dockerfilePath: ./Dockerfile
    dockerCommand: node scripts/production-start.mjs
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3000"
      - key: VITE_APP_ID
        value: e3lani-live
      - key: EXPO_PUBLIC_APP_ID
        value: e3lani-live
      - key: PUBLIC_APP_URL
        value: https://e3lani-live.onrender.com
      - key: CORS_ALLOWED_ORIGINS
        value: https://e3lani-live.onrender.com
      - key: FFMPEG_PATH
        value: /usr/bin/ffmpeg
      - key: VIDEO_FONT_PATH
        value: /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
      - key: REQUIRE_MEDIA_STORAGE
        value: "true"
      - key: JWT_SECRET
        generateValue: true
      - key: DATABASE_URL
        sync: false
      - key: BUILT_IN_FORGE_API_URL
        sync: false
      - key: BUILT_IN_FORGE_API_KEY
        sync: false
      - key: MODERATION_PROVIDER_URL
        sync: false
      - key: MODERATION_PROVIDER_API_KEY
        sync: false
      - key: MODERATION_PROVIDER_HOSTS
        sync: false
`,
);

write(
  "tests/critical-production-safety.test.ts",
  `import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(\`../\${path}\`, import.meta.url), "utf8");

describe("production safety hardening", () => {
  it("does not reflect arbitrary origins or share cookies with onrender parent domains", () => {
    const server = read("server/_core/index.ts");
    const cookies = read("server/_core/cookies.ts");
    expect(server).toContain("ORIGIN_NOT_ALLOWED");
    expect(server).not.toContain('Access-Control-Allow-Origin", origin);\n    }\n    res.header');
    expect(cookies).toContain('sameSite: "lax"');
    expect(cookies).not.toContain("parts.slice(-2)");
  });

  it("requires schema verification, storage, ffmpeg and Docker production runtime", () => {
    expect(read("render.yaml")).toContain("runtime: docker");
    expect(read("Dockerfile")).toContain("ffmpeg");
    expect(read("scripts/production-start.mjs")).toContain("verify-production-schema.mjs");
    expect(read("scripts/verify-production-schema.mjs")).toContain("MIGRATION_0010_PARTIAL_STATE");
  });

  it("scopes idempotency and protects admin-held ads", () => {
    const identity = read("server/content-identity.ts");
    const ads = read("server/ads-service.ts");
    expect(identity).toContain("ownerCondition");
    expect(ads).toContain("AD_ADMIN_HOLD");
    expect(ads).toContain("CITY_NOT_FOUND_FOR_COUNTRY");
    expect(ads).toContain('source: "edited_text"');
  });
});
`,
);

replaceExactly(
  ".github/workflows/ci.yml",
  `    timeout-minutes: 30`,
  `    timeout-minutes: 45`,
  1,
);
replaceExactly(
  ".github/workflows/ci.yml",
  `      - name: Export Expo web
        run: pnpm exec expo export --platform web --output-dir dist-web`,
  `      - name: Export Expo web
        run: pnpm exec expo export --platform web --output-dir dist-web

      - name: Build production Docker image
        run: docker build --tag e3lani-ci:\${{ github.sha }} .`,
  1,
);

console.log("Critical safety patch applied successfully.");
