import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { permissionsForRole, type AdminRoleKey, type Permission } from '@e3lani/config';
import { PERMISSIONS_KEY } from '../decorators';
import { PrismaService } from '../services/prisma.service';
import { extractBearer } from './jwt-auth.guard';

/** حارس لوحة الإدارة: رمز منفصل تمامًا + تحقق صلاحيات حقيقي (RBAC). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearer(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException({ message: 'يلزم تسجيل دخول الإدارة', code: 'ADMIN_UNAUTHENTICATED' });
    }

    let payload: { sub: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('ADMIN_JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({ message: 'جلسة الإدارة منتهية', code: 'ADMIN_TOKEN_INVALID' });
    }

    if (payload.typ !== 'admin') {
      throw new UnauthorizedException({ message: 'رمز غير صالح للوحة الإدارة', code: 'ADMIN_TOKEN_INVALID' });
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({ message: 'حساب الإدارة غير مفعّل', code: 'ADMIN_DISABLED' });
    }

    const permissions = permissionsForRole(admin.role as AdminRoleKey);
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required?.length) {
      const missing = required.filter((permission) => !permissions.includes(permission));
      if (missing.length) {
        throw new ForbiddenException({
          message: 'لا تملك صلاحية تنفيذ هذا الإجراء',
          code: 'FORBIDDEN',
          required: missing,
        });
      }
    }

    request.admin = { id: admin.id, email: admin.email, role: admin.role, permissions };
    return true;
  }
}
