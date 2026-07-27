import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AuthService, createRefreshToken, hashRefreshToken } from './auth.service';

describe('refresh token helpers', () => {
  it('hashes refresh tokens deterministically without storing the raw token', () => {
    const token = createRefreshToken();
    const hash = hashRefreshToken(token);

    expect(token.length).toBeGreaterThanOrEqual(20);
    expect(hash).toBe(hashRefreshToken(token));
    expect(hash).not.toBe(token);
  });

  it('rotates refresh session hashes on refresh', async () => {
    const oldToken = createRefreshToken();
    const update = vi.fn();
    const create = vi.fn();
    const prisma = {
      userSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          deviceId: 'device-1',
          ip: '127.0.0.1',
          userAgent: 'vitest',
          user: {
            id: 'user-1',
            phone: '+966500000000',
            displayName: 'Tester',
            roles: ['USER'],
            locale: 'en',
            countryCode: 'SA',
            deletedAt: null,
            isSuspended: false,
          },
        }),
      },
      $transaction: vi.fn(async (callback: (tx: { userSession: { update: typeof update; create: typeof create } }) => Promise<void>) =>
        callback({ userSession: { update, create } }),
      ),
    } as unknown as PrismaService;
    const jwt = { signAsync: vi.fn().mockResolvedValue('access-token') };
    const audit = { write: vi.fn().mockResolvedValue({}) } as unknown as AuditService;
    const service = new AuthService(prisma, jwt as never, audit);

    const result = await service.refresh(oldToken);
    const createdHash = create.mock.calls[0]?.[0]?.data?.refreshTokenHash;

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).not.toBe(oldToken);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(createdHash).toBe(hashRefreshToken(result.refreshToken));
    expect(createdHash).not.toBe(hashRefreshToken(oldToken));
  });
});
