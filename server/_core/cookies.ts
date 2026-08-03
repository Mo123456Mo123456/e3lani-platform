import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  const values = Array.isArray(forwarded) ? forwarded : String(forwarded ?? "").split(",");
  return values.some((value) => value.trim().toLowerCase() === "https");
}

function configuredCookieDomain(req: Request): string | undefined {
  const configured = process.env.COOKIE_DOMAIN?.trim().replace(/^\./, "").toLowerCase();
  if (!configured) return undefined;
  const hostname = req.hostname.toLowerCase();
  if (hostname !== configured && !hostname.endsWith(`.${configured}`)) return undefined;
  return `.${configured}`;
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
