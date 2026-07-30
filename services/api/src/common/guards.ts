import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { ADMIN_ROLES, type UserRole } from "@kawkab/shared-types";
import { IS_PUBLIC_KEY, ROLES_KEY, type AuthUser } from "./decorators.js";

interface AccessClaims {
  sub: string;
  email: string;
  role: UserRole;
  displayName: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractToken(req);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException("missing access token");
    }
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? "dev-only-access-secret-change-me",
      });
      req.user = { id: claims.sub, email: claims.email, role: claims.role, displayName: claims.displayName };
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException("invalid or expired access token");
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (requiredRoles && requiredRoles.length > 0) {
      const userRole = req.user!.role;
      if (!requiredRoles.includes(userRole)) {
        throw new ForbiddenException("insufficient role");
      }
    }
    return true;
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.["access_token"];
  return cookieToken ?? null;
}

/** verify a token for WebSocket handshakes (no guards there) */
export async function verifyWsToken(jwt: JwtService, token: string): Promise<AuthUser | null> {
  try {
    const claims = await jwt.verifyAsync<AccessClaims>(token, {
      secret: process.env.JWT_ACCESS_SECRET ?? "dev-only-access-secret-change-me",
    });
    return { id: claims.sub, email: claims.email, role: claims.role, displayName: claims.displayName };
  } catch {
    return null;
  }
}

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}
