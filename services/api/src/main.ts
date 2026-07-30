import { BadRequestException, Catch } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { Response } from "express";
import "reflect-metadata";
import { ZodError } from "zod";

import { AppModule } from "./app.module.js";

@Catch(ZodError)
class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(400).json({
      statusCode: 400,
      error: "Validation Error",
      issues: exception.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: [process.env.WEB_ORIGIN, process.env.ADMIN_ORIGIN].filter(Boolean),
    credentials: false,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  app.useGlobalFilters(new ZodExceptionFilter());
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");
}

bootstrap().catch((error) => {
  const wrapped =
    error instanceof Error ? error : new BadRequestException("API_BOOTSTRAP_FAILED");
  console.error(wrapped);
  process.exit(1);
});
