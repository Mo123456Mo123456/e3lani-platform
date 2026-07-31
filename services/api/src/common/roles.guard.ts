import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ROLE_RANK, type Role } from "@planet/shared-types";
import { ROLES_KEY, type AuthedRequest } from "./auth.guard";

/** RBAC: routes declare a minimum role rank via @MinRole. */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const minRole =
      (Reflect.getMetadata(ROLES_KEY, context.getHandler()) as Role | undefined) ??
      (Reflect.getMetadata(ROLES_KEY, context.getClass()) as Role | undefined);
    if (!minRole) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ error: "authentication_required" });
    }
    const userRank = ROLE_RANK[user.role as Role] ?? 0;
    if (userRank < ROLE_RANK[minRole]) {
      throw new ForbiddenException({ error: "insufficient_role", required: minRole });
    }
    return true;
  }
}
