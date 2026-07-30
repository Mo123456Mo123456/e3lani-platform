import {
  BadRequestException,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { PrismaClient, Role } from "@e3lani/database";
import type { Request } from "express";
import type { ZodType } from "zod";

export type AuthUser = {
  id: string;
  sessionId: string;
  roles: Role[];
};

export type AuthenticatedRequest = Request & { user?: AuthUser };

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

@Injectable()
export class PrismaService extends PrismaClient {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export const Public = () => SetMetadata("public", true);
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException();
    return request.user;
  },
);

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>("public", [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException("ACCESS_TOKEN_REQUIRED");

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        sid: string;
        roles: Role[];
        type: string;
      }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
        issuer: "e3lani-api",
        audience: "e3lani-clients",
      });
      if (payload.type !== "access") throw new Error("WRONG_TOKEN_TYPE");
      const session = await this.prisma.authSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: "ACTIVE" },
        },
        select: { id: true },
      });
      if (!session) throw new Error("SESSION_REVOKED");
      request.user = { id: payload.sub, sessionId: payload.sid, roles: payload.roles };
      return true;
    } catch {
      throw new UnauthorizedException("INVALID_OR_EXPIRED_ACCESS_TOKEN");
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user || !required.some((role) => request.user!.roles.includes(role))) {
      throw new UnauthorizedException("INSUFFICIENT_ROLE");
    }
    return true;
  }
}
