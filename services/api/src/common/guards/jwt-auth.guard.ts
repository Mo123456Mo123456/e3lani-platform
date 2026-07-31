import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ADMIN_ONLY_KEY, IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../decorators';
import { PrismaService } from '../services/prisma.service';

/**
 * حارس المصادقة العام: يقرأ رمز الوصول ويُرفق المستخدم بالطلب.
 * المسارات المعلّمة بـ @Public تمر بدون رمز، و@OptionalAuth تمر مع أو بدونه.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    const isAdminRoute = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, targets);
    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets);
    if (isPublic || isAdminRoute) return true;

    const request = context.switchToHttp().getRequest();
    const token = extractBearer(request.headers.authorization);

    if (!token) {
      if (isOptional) return true;
      throw new UnauthorizedException({ message: 'يلزم تسجيل الدخول', code: 'UNAUTHENTICATED' });
    }

    let payload: { sub: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      if (isOptional) return true;
      throw new UnauthorizedException({ message: 'رمز الدخول منتهٍ أو غير صالح', code: 'TOKEN_INVALID' });
    }

    if (payload.typ && payload.typ !== 'access') {
      throw new UnauthorizedException({ message: 'نوع الرمز غير صحيح', code: 'TOKEN_INVALID' });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, accountType: true, status: true, profileCompleted: true },
    });

    if (!user || user.status === 'DELETED') {
      if (isOptional) return true;
      throw new UnauthorizedException({ message: 'الحساب غير موجود', code: 'USER_NOT_FOUND' });
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({ message: 'تم إيقاف هذا الحساب', code: 'USER_SUSPENDED' });
    }

    request.user = user;
    return true;
  }
}

export function extractBearer(header?: string): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim();
}
