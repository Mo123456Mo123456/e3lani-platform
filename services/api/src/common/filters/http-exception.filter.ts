import {
  ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** شكل خطأ موحّد لكل واجهات البرمجة. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let payload: Record<string, unknown> = {
      statusCode: status,
      message: 'حدث خطأ غير متوقع',
      code: 'INTERNAL_ERROR',
    };

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      payload =
        typeof body === 'string'
          ? { statusCode: status, message: body, code: 'ERROR' }
          : { statusCode: status, code: 'ERROR', ...(body as Record<string, unknown>) };
    } else {
      this.logger.error(
        `${request.method} ${request.url} — ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    response.status(status).json({
      ...payload,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
