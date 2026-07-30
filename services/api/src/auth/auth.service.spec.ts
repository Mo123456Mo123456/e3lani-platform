import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const users: any[] = [];
  const refreshTokens: any[] = [];

  const prisma: any = {
    user: {
      create: async ({ data }: any) => {
        const user = {
          id: `user_${users.length + 1}`,
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: data.displayName,
          role: data.role,
          level: 1,
          xp: 0,
          locale: data.locale,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(user);
        return user;
      },
      findUnique: async ({ where }: any) =>
        users.find((user) => user.id === where.id || user.email === where.email) ?? null,
    },
    refreshToken: {
      create: async ({ data }: any) => {
        const row = { ...data, revokedAt: null, createdAt: new Date() };
        refreshTokens.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = refreshTokens.find((token) => token.id === where.id);
        if (!row) {
          return null;
        }
        return include?.user
          ? { ...row, user: users.find((user) => user.id === row.userId) }
          : row;
      },
      update: async ({ where, data }: any) => {
        const row = refreshTokens.find((token) => token.id === where.id);
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const row of refreshTokens) {
          if (row.id === where.id && row.revokedAt === where.revokedAt) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return { count };
      },
    },
  };

  const config: any = {
    get: (key: string) =>
      ({
        jwtAccessSecret: "test-access-secret-with-enough-length",
        jwtRefreshSecret: "test-refresh-secret-with-enough-length",
        jwtAccessTtl: "15m",
        jwtRefreshTtl: "30d",
      })[key],
    getOrThrow(key: string) {
      return this.get(key);
    },
  };

  let service: AuthService;

  beforeEach(() => {
    users.length = 0;
    refreshTokens.length = 0;
    service = new AuthService(prisma, new JwtService(), config);
  });

  it("registers, logs in, and rotates refresh tokens", async () => {
    const registered = await service.register({
      email: "Explorer@Planet-Born.local",
      password: "Explorer!2026",
      displayName: "Explorer",
      locale: "ar",
    });

    expect(registered.user.email).toBe("explorer@planet-born.local");
    expect(registered.accessToken).toBeTruthy();
    expect(refreshTokens).toHaveLength(1);

    const loggedIn = await service.login({
      email: "explorer@planet-born.local",
      password: "Explorer!2026",
    });
    expect(loggedIn.refreshToken).toBeTruthy();
    expect(refreshTokens).toHaveLength(2);

    const rotated = await service.refresh({ refreshToken: loggedIn.refreshToken });
    expect(rotated.refreshToken).not.toBe(loggedIn.refreshToken);
    expect(refreshTokens).toHaveLength(3);
    expect(refreshTokens[1].revokedAt).toBeInstanceOf(Date);
  });
});
