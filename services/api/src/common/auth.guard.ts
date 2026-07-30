import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { Role } from "@planet/shared-types";
import { verifyAccessToken, type AccessClaims } from "../auth/jwt.util";

export const IS_PUBLIC = Symbol("is_public_route");
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthedRequest extends Request {
  user?: AccessClaims;
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = Reflect.getMetadata(IS_PUBLIC, context.getHandler()) as boolean | undefined;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const cookieToken = (req.headers.cookie ?? "")
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("pb_access="))
      ?.slice("pb_access=".length);
    const token = header.startsWith("Bearer ") ? header.slice(7) : cookieToken;
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException({ error: "missing_token" });
    }
    try {
      req.user = await verifyAccessToken(token);
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException({ error: "invalid_token" });
    }
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.user ?? null;
});

export const ROLES_KEY = Symbol("min_role");
export const MinRole = (role: Role) => SetMetadata(ROLES_KEY, role);
