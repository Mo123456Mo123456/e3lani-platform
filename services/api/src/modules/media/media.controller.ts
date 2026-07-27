import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { requireUserId } from '../../common/auth.util';
import { MediaService } from './media.service';

function readUploadBody(req: RawBodyRequest<Request>): Buffer {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  throw new BadRequestException('RAW_BODY_REQUIRED');
}

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

  /** Sandbox storage PUT target (signed URL). No auth — signature is the auth. */
  @Put('media/sandbox/upload')
  async sandboxUpload(
    @Query('key') key: string | undefined,
    @Query('exp') expRaw: string | undefined,
    @Query('sig') sig: string | undefined,
    @Query('mime') mime: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!key || !expRaw || !sig || !mime) {
      throw new BadRequestException('MISSING_SANDBOX_UPLOAD_PARAMS');
    }
    const exp = Number(expRaw);
    if (!Number.isFinite(exp)) throw new BadRequestException('INVALID_EXP');
    const body = readUploadBody(req);
    return this.media.putSandboxUpload({ key, exp, sig, mime, body });
  }

  /** Sandbox storage GET target (signed URL). */
  @Get('media/sandbox/download')
  async sandboxDownload(
    @Query('key') key: string | undefined,
    @Query('exp') expRaw: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ) {
    if (!key || !expRaw || !sig) {
      throw new BadRequestException('MISSING_SANDBOX_DOWNLOAD_PARAMS');
    }
    const exp = Number(expRaw);
    if (!Number.isFinite(exp)) throw new BadRequestException('INVALID_EXP');
    const file = await this.media.getSandboxDownload({ key, exp, sig });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(file.body);
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
  @Post('media/:assetId/cleanup')
  async cleanup(
    @Headers('authorization') authorization: string | undefined,
    @Param('assetId') assetId: string,
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.media.cleanupAsset(user.sub, assetId);
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
