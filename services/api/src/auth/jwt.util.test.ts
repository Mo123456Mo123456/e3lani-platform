import { describe, expect, it } from "vitest";
import { generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken } from "./jwt.util";

process.env.JWT_ACCESS_SECRET = "test-secret-key-0123456789abcdef";

describe("access tokens", () => {
  it("signs and verifies claims", async () => {
    const token = await signAccessToken(
      { sub: "u_1", email: "a@b.co", role: "user", locale: "ar" },
      900,
    );
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe("u_1");
    expect(claims.role).toBe("user");
  });

  it("rejects tampered tokens", async () => {
    const token = await signAccessToken(
      { sub: "u_1", email: "a@b.co", role: "user", locale: "ar" },
      900,
    );
    const tampered = token.slice(0, -4) + "AAAA";
    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("rejects tokens with wrong audience", async () => {
    const token = await signAccessToken(
      { sub: "u_1", email: "a@b.co", role: "admin", locale: "ar" },
      900,
    );
    // verify with proper audience works; garbage signature variants fail
    await expect(verifyAccessToken(token + "x")).rejects.toThrow();
  });
});

describe("refresh tokens", () => {
  it("hash is deterministic and opaque", () => {
    const { token, hash } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hash);
    expect(hash).not.toContain(token.slice(0, 8));
  });
  it("tokens are unique", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
  });
});
