import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { raw } from 'express';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Accept binary PUT bodies for sandbox signed uploads (images/videos).
    consumer
      .apply(raw({ type: '*/*', limit: '210mb' }))
      .forRoutes({ path: 'media/sandbox/upload', method: RequestMethod.PUT });
  }
}
