import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export type AuthPayload = {
  sub: string;
  roles: string[];
};

export type ActiveUserPayload = AuthPayload & {
  user: {
    id: string;
    roles: string[];
    isSuspended: boolean;
    deletedAt: Date | null;
  };
};

export async function requireUserId(
  jwt: JwtService,
  authorization?: string,
  prisma?: PrismaService,
): Promise<AuthPayload> {
  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedException('MISSING_TOKEN');
  }
  const payload = await jwt.verifyAsync<AuthPayload>(authorization.slice('Bearer '.length));
  if (prisma) {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isSuspended: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('USER_NOT_FOUND');
    }
    if (user.isSuspended) {
      throw new UnauthorizedException('ACCOUNT_SUSPENDED');
    }
  }
  return payload;
}

export async function requireActiveUser(
  jwt: JwtService,
  authorization: string | undefined,
  prisma: PrismaService,
): Promise<ActiveUserPayload> {
  const payload = await requireUserId(jwt, authorization);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, roles: true, isSuspended: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    throw new UnauthorizedException('USER_NOT_FOUND');
  }
  if (user.isSuspended) {
    throw new UnauthorizedException('ACCOUNT_SUSPENDED');
  }
  return {
    ...payload,
    roles: user.roles,
    user,
  };
}

export function assertRole(payload: AuthPayload, allowed: string[]): void {
  if (!payload.roles.some((role) => allowed.includes(role))) {
    throw new UnauthorizedException('FORBIDDEN_ROLE');
  }
}
