import { Module } from '@nestjs/common';
import { SavesService } from './saves.service';
import { SavesController } from './saves.controller';

@Module({
  controllers: [SavesController],
  providers: [SavesService],
  exports: [SavesService],
})
export class SavesModule {}
