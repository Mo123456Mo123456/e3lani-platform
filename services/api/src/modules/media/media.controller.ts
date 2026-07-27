import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { requireUserId } from '../../common/auth.util';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller()
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly jwt: JwtService,
  ) {}

  @ApiBearerAuth()
  @Post('media/upload-intent')
  async uploadIntent(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      kind: 'image' | 'video';
      mimeType: string;
      sizeBytes: number;
      durationSeconds?: number;
      adId?: string;
    },
  ) {
    this.media.requireStorageConfigured();
    const user = await requireUserId(this.jwt, authorization);
    return this.media.createUploadIntent(user.sub, body);
  }

  @ApiBearerAuth()
  @Post('media/:assetId/complete')
  async complete(
    @Headers('authorization') authorization: string | undefined,
    @Param('assetId') assetId: string,
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.media.completeUpload(user.sub, assetId);
  }

  @ApiBearerAuth()
  @Get('media/:assetId')
  async get(
    @Headers('authorization') authorization: string | undefined,
    @Param('assetId') assetId: string,
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.media.getAsset(assetId, user.sub);
  }

  @ApiBearerAuth()
  @Post('ads/:adId/media')
  async attach(
    @Headers('authorization') authorization: string | undefined,
    @Param('adId') adId: string,
    @Body() body: { assetId: string; sortOrder?: number },
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.media.attachToAd(user.sub, adId, body.assetId, body.sortOrder ?? 0);
  }
}
