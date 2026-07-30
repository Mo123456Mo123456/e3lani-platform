import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { randomBytes, createHash } from "node:crypto";
import type { Role } from "@planet/shared-types";

export interface AccessClaims {
  sub: string;
  email: string;
  role: Role;
  locale: string;
}

function accessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET ?? "";
  if (secret.length < 16) throw new Error("JWT_ACCESS_SECRET too short");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: AccessClaims, ttlSeconds: number): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role, locale: claims.locale })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("planet-born-api")
    .setAudience("planet-born-web")
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessSecret(), {
    issuer: "planet-born-api",
    audience: "planet-born-web",
  });
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as Role,
    locale: (payload.locale as string) ?? "ar",
  };
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<{ sub: string; email: string; name?: string }> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  return { sub: payload.sub as string, email: payload.email as string, name: payload.name as string | undefined };
}

export async function verifyAppleIdToken(idToken: string, clientId: string): Promise<{ sub: string; email: string }> {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    audience: clientId,
  });
  return { sub: payload.sub as string, email: payload.email as string };
}
