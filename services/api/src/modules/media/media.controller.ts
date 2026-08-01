import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { completeUploadSchema, createUploadSchema } from '@e3lani/types';
import { MediaService } from './media.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, RateLimit, type AuthUser } from '../../common/decorators';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('uploads')
  @RateLimit({ limit: 60, windowSeconds: 600, by: 'user' })
  async createUpload(@CurrentUser() user: AuthUser, @Body(zodPipe(createUploadSchema)) body: any) {
    return this.media.createUpload(user.id, body);
  }

  @Post('uploads/complete')
  @RateLimit({ limit: 60, windowSeconds: 600, by: 'user' })
  async completeUpload(
    @CurrentUser() user: AuthUser,
    @Body(zodPipe(completeUploadSchema)) body: { mediaId: string },
  ) {
    return this.media.completeUpload(user.id, body.mediaId);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.media.get(user.id, id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.media.remove(user.id, id);
    return { deleted: true };
  }
}
