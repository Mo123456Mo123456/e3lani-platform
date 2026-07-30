import { COOKIE_NAME, SESSION_TTL_MS } from "../../shared/const.js";
import { createHmac } from "node:crypto";
import type { Express, Request, Response } from "express";
import {
  checkAuthRateLimit,
  clearAuthRateLimit,
  getUserByOpenId,
  recordAuthFailure,
  upsertUser,
} from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const AUTH_RATE_LIMIT_POLICY = {
  maxAttempts: 6,
  windowMs: 10 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} as const;

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  if (!saved) throw new Error("Failed to persist authenticated user");
  return saved;
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
        role?: string;
        accountType?: string;
        status?: string;
        preferredLanguage?: string;
        cityId?: number | null;
      },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    role: (user as any)?.role ?? "user",
    accountType: (user as any)?.accountType ?? "viewer",
    status: (user as any)?.status ?? "active",
    preferredLanguage: (user as any)?.preferredLanguage ?? "ar",
    cityId: (user as any)?.cityId ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

function getRequestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return first?.trim() || req.ip || req.socket.remoteAddress || "unknown";
}

function getRateLimitKey(req: Request, scope: string) {
  return createHmac("sha256", ENV.cookieSecret)
    .update(`${scope}:${getRequestIp(req)}`)
    .digest("hex");
}

async function enforceRateLimit(req: Request, res: Response, scope: string) {
  const keyHash = getRateLimitKey(req, scope);
  const result = await checkAuthRateLimit(scope, keyHash);
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    res.status(429).json({ error: "Too many authentication attempts" });
    return null;
  }
  return keyHash;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const rateKey = await enforceRateLimit(req, res, "oauth_web");
    if (!rateKey) return;

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const session = await sdk.createManagedSession(user, req, "web");
      await clearAuthRateLimit("oauth_web", rateKey);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, session.token, { ...cookieOptions, maxAge: SESSION_TTL_MS });

      // Redirect to the frontend URL (Expo web on port 8081)
      // Cookie is set with parent domain so it works across both 3000 and 8081 subdomains
      const frontendUrl =
        process.env.EXPO_WEB_PREVIEW_URL ||
        process.env.EXPO_PACKAGER_PROXY_URL ||
        "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch (error) {
      await recordAuthFailure("oauth_web", rateKey, AUTH_RATE_LIMIT_POLICY);
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const rateKey = await enforceRateLimit(req, res, "oauth_native");
    if (!rateKey) return;

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const session = await sdk.createManagedSession(user, req, "native");
      await clearAuthRateLimit("oauth_native", rateKey);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, session.token, { ...cookieOptions, maxAge: SESSION_TTL_MS });

      res.json({
        app_session_id: session.token,
        user: buildUserResponse(user),
      });
    } catch (error) {
      await recordAuthFailure("oauth_native", rateKey, AUTH_RATE_LIMIT_POLICY);
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      await sdk.revokeRequestSession(req);
    } catch (error) {
      console.warn("[Auth] Failed to revoke session during logout", String(error));
    }
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "Invalid session cookie") {
        console.warn("[Auth] /api/auth/me rejected:", message);
      }
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    const rateKey = await enforceRateLimit(req, res, "session_exchange");
    if (!rateKey) return;

    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
      await clearAuthRateLimit("session_exchange", rateKey);

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      await recordAuthFailure("session_exchange", rateKey, AUTH_RATE_LIMIT_POLICY);
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
