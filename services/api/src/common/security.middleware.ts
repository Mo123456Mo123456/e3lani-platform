import type { NextFunction, Request, Response } from "express";

/** Security headers incl. a strict CSP for the API surface. */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "content-security-policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  res.setHeader("cross-origin-resource-policy", "same-site");
  next();
}

/** Simple CORS allow-list driven by env-provided origins. */
export function corsMiddleware(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins.filter(Boolean));
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("access-control-allow-credentials", "true");
      res.setHeader("vary", "origin");
    }
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.setHeader("access-control-allow-headers", "content-type,authorization");
      res.setHeader("access-control-max-age", "600");
      res.status(204).end();
      return;
    }
    next();
  };
}
