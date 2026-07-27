import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type AuthPayload = {
  sub: string;
  roles: string[];
};

export async function requireUserId(
  jwt: JwtService,
  authorization?: string,
): Promise<AuthPayload> {
  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedException('MISSING_TOKEN');
  }
  return jwt.verifyAsync<AuthPayload>(authorization.slice('Bearer '.length));
}

export function assertRole(payload: AuthPayload, allowed: string[]): void {
  if (!payload.roles.some((role) => allowed.includes(role))) {
    throw new UnauthorizedException('FORBIDDEN_ROLE');
  }
}
