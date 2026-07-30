import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { getDatabase } from "./database.js";

export interface RequestUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

const encoder = new TextEncoder();
const accessSecret = () => {
  const value = process.env.JWT_ACCESS_SECRET ?? (process.env.SANDBOX_MODE === "true" ? "sandbox-access-secret-change-me-32!" : "");
  if (value.length < 32) throw new Error("JWT_ACCESS_SECRET must contain at least 32 characters");
  return encoder.encode(value);
};
const refreshSecret = () => {
  const value = process.env.JWT_REFRESH_SECRET ?? (process.env.SANDBOX_MODE === "true" ? "sandbox-refresh-secret-change-me-32" : "");
  if (value.length < 32) throw new Error("JWT_REFRESH_SECRET must contain at least 32 characters");
  return encoder.encode(value);
};
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function signAccessToken(user: RequestUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.displayName,
    roles: user.roles,
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer("living-planet-api")
    .setAudience("living-planet-web")
    .sign(accessSecret());
}

export async function issueRefreshToken(userId: string, familyId = randomUUID()): Promise<string> {
  const sql = getDatabase();
  const id = randomUUID();
  const secret = randomBytes(48).toString("base64url");
  const raw = `${id}.${secret}`;
  const signedBinding = await new SignJWT({ tokenHash: hashToken(raw), tokenType: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .setIssuer("living-planet-api")
    .sign(refreshSecret());
  const token = `${raw}.${signedBinding}`;
  await sql`
    INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at)
    VALUES (${id}, ${userId}, ${hashToken(token)}, ${familyId}, now() + interval '30 days')
  `;
  return token;
}

export async function rotateRefreshToken(token: string): Promise<{ user: RequestUser; token: string }> {
  const sql = getDatabase();
  const parts = token.split(".");
  const id = parts[0];
  const binding = parts.slice(2).join(".");
  if (!id || !binding) throw new Error("Malformed refresh token");
  const verified = await jwtVerify(binding, refreshSecret(), { issuer: "living-planet-api" });
  const rows = await sql<{
    id: string;
    user_id: string;
    token_hash: string;
    family_id: string;
    expires_at: Date;
    revoked_at: Date | null;
  }[]>`
    SELECT id, user_id, token_hash, family_id, expires_at, revoked_at
    FROM refresh_tokens WHERE id = ${id}
  `;
  const stored = rows[0];
  if (
    !stored ||
    verified.payload.sub !== stored.user_id ||
    verified.payload.tokenHash !== hashToken(parts.slice(0, 2).join(".")) ||
    stored.token_hash !== hashToken(token)
  ) {
    throw new Error("Invalid refresh token");
  }
  if (stored.revoked_at) {
    await sql`UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = ${stored.family_id}`;
    throw new Error("Refresh token reuse detected; token family revoked");
  }
  if (stored.expires_at.getTime() <= Date.now()) throw new Error("Refresh token expired");
  const replacement = await issueRefreshToken(stored.user_id, stored.family_id);
  const replacementId = replacement.split(".")[0];
  await sql`
    UPDATE refresh_tokens
    SET revoked_at = now(), replaced_by = ${replacementId}
    WHERE id = ${stored.id} AND revoked_at IS NULL
  `;
  return { user: await loadUser(stored.user_id), token: replacement };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const id = token.split(".")[0];
  if (id) await getDatabase()`UPDATE refresh_tokens SET revoked_at = now() WHERE id = ${id}`;
}

export async function loadUser(userId: string): Promise<RequestUser> {
  const rows = await getDatabase()<{
    id: string;
    email: string;
    display_name: string;
    roles: string[];
  }[]>`
    SELECT u.id, u.email, u.display_name,
      COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ${userId} AND u.status = 'active'
    GROUP BY u.id
  `;
  const row = rows[0];
  if (!row) throw new Error("User not found");
  return { id: row.id, email: row.email, displayName: row.display_name, roles: row.roles };
}

export async function authenticate(request: FastifyRequest): Promise<RequestUser> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication required");
  const token = authorization.slice(7);
  const verified = await jwtVerify(token, accessSecret(), {
    issuer: "living-planet-api",
    audience: "living-planet-web",
  });
  if (!verified.payload.sub || verified.payload.tokenType !== "access") throw new Error("Invalid access token");
  return {
    id: verified.payload.sub,
    email: String(verified.payload.email ?? ""),
    displayName: String(verified.payload.name ?? ""),
    roles: Array.isArray(verified.payload.roles) ? verified.payload.roles.map(String) : [],
  };
}

export function requireRole(user: RequestUser, ...roles: string[]): void {
  if (!user.roles.includes("super_admin") && !roles.some((role) => user.roles.includes(role))) {
    throw new Error("Insufficient permissions");
  }
}
