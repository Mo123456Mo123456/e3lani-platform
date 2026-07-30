/**
 * Token service — short-lived JWT access tokens + opaque rotating refresh
 * tokens. Refresh tokens are single-use and stored hashed; a rotated token
 * presented twice revokes the entire family (theft detection).
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AuthTokens, Role, User } from "@planet/shared-types";
import type { Repository } from "../store/repository.js";

export interface TokenSigner {
  sign(payload: Record<string, unknown>, options: { expiresIn: string }): string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class TokenService {
  constructor(
    private readonly repository: Repository,
    private readonly signer: TokenSigner,
    private readonly accessTtlSeconds: number,
    private readonly refreshTtlSeconds: number,
  ) {}

  async issue(user: User, familyId: string = randomUUID()): Promise<AuthTokens> {
    const accessToken = this.signer.sign(
      { sub: user.id, email: user.email, roles: user.roles },
      { expiresIn: `${this.accessTtlSeconds}s` },
    );
    const refreshToken = randomBytes(48).toString("base64url");
    await this.repository.storeRefreshToken({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      revoked: false,
      expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds };
  }

  /**
   * Rotate a refresh token. Returns null when invalid; revokes the family
   * and returns "reuse-detected" when a spent token is replayed.
   */
  async rotate(refreshToken: string): Promise<{ user: User; tokens: AuthTokens } | "reuse-detected" | null> {
    const record = await this.repository.findRefreshToken(hashToken(refreshToken));
    if (!record) return null;
    if (record.revoked) {
      // token replay — kill the whole family
      await this.repository.revokeRefreshFamily(record.familyId);
      return "reuse-detected";
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) return null;
    await this.repository.revokeRefreshToken(record.id);
    const user = await this.repository.findUserById(record.userId);
    if (!user) return null;
    const tokens = await this.issue(user, record.familyId);
    return { user, tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    const record = await this.repository.findRefreshToken(hashToken(refreshToken));
    if (record) await this.repository.revokeRefreshFamily(record.familyId);
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string; roles: Role[] };
    user: { sub: string; email: string; roles: Role[] };
  }
}
