import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { Request } from "express";
import { PrismaService } from "./prisma.service.js";
import type { AuthUser } from "./decorators.js";

const AUDITED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** writes mutating requests to the audit log (fire-and-forget) */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!AUDITED_METHODS.has(req.method) || !process.env.DATABASE_URL) {
      return next.handle();
    }
    return next.handle().pipe(
      tap({
        next: () => {
          void this.prisma.auditLog
            .create({
              data: {
                userId: req.user?.id ?? null,
                action: `${req.method} ${req.route?.path ?? req.url}`,
                metadata: JSON.parse(JSON.stringify({ params: req.params, query: req.query })) as object,
                ip: req.ip ?? null,
              },
            })
            .catch(() => undefined);
        },
      }),
    );
  }
}
