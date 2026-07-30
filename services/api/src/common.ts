import {
  BadRequestException,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { prisma, type StaffRole } from "@e3lani/database";
import type { Request } from "express";
import type { ZodType } from "zod";

export interface AuthUser {
  id: string;
  sessionId: string;
  staffRole: StaffRole | null;
}

export type AuthRequest = Request & { user?: AuthUser };

export const Public = () => SetMetadata("public", true);
export const Roles = (...roles: StaffRole[]) => SetMetadata("roles", roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<AuthRequest>().user;
    if (!user) throw new UnauthorizedException();
    return user;
  }
);

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }
  return result.data;
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>("public", [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException("AUTH_REQUIRED");

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token);
      const session = await prisma.session.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: "ACTIVE" }
        },
        include: { user: { select: { staffRole: true } } }
      });
      if (!session) throw new UnauthorizedException("SESSION_REVOKED");
      request.user = {
        id: payload.sub,
        sessionId: payload.sid,
        staffRole: session.user.staffRole
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("TOKEN_INVALID");
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<StaffRole[]>("roles", [
      context.getHandler(),
      context.getClass()
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<AuthRequest>().user;
    return Boolean(user?.staffRole && roles.includes(user.staffRole));
  }
}
