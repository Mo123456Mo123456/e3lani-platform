import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { AuthService, type AccessPayload } from "./auth.service.js";

export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AccessPayload => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest & { user: AccessPayload }>();
  return req.user;
});

/** Verifies the Bearer access token and attaches the payload to the request. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AccessPayload }>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("missing_bearer_token");
    req.user = this.auth.verifyAccess(header.slice(7));
    return true;
  }
}

/** RBAC: role hierarchy check after JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AccessPayload }>();
    const role = req.user?.role;
    if (!role) throw new UnauthorizedException();
    if (!required.includes(role)) throw new ForbiddenException("insufficient_role");
    return true;
  }
}

/** Role hierarchy — higher index inherits lower permissions. */
export const ROLE_ORDER = [
  "visitor",
  "registered",
  "explorer",
  "life_maker",
  "civ_builder",
  "historian",
  "content_moderator",
  "simulation_manager",
  "system_admin",
  "super_admin",
] as const;

export function roleAtLeast(role: string, minimum: string): boolean {
  const a = ROLE_ORDER.indexOf(role as (typeof ROLE_ORDER)[number]);
  const b = ROLE_ORDER.indexOf(minimum as (typeof ROLE_ORDER)[number]);
  return a >= 0 && b >= 0 && a >= b;
}
