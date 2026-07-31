import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('E3lani');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // نحتاج الجسم الخام للتحقق من توقيع webhooks الدفع
    rawBody: true,
    bufferLogs: false,
  });

  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX') ?? 'api';
  const port = config.get<number>('API_PORT') ?? 4000;
  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix(prefix);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(compression());
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.enableShutdownHooks();

  if (config.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('إعلاني | E3lani API')
      .setDescription('منصة الإعلانات المرئية لكل شيء')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, document);
    logger.log(`توثيق الـ API: http://localhost:${port}/${prefix}/docs`);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`خدمة إعلاني تعمل على http://localhost:${port}/${prefix}`);
}

void bootstrap();
