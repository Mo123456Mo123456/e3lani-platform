import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { UserRole } from "@kawkab/shared-types";

export const IS_PUBLIC_KEY = "isPublic";
/** marks a route as anonymous (no JWT required) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
  return req.user ?? null;
});
