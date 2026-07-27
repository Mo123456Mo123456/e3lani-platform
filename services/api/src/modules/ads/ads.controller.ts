import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { requireUserId } from '../../common/auth.util';
import { AdsService } from './ads.service';

@ApiTags('ads')
@Controller('ads')
export class AdsController {
  constructor(
    private readonly ads: AdsService,
    private readonly jwt: JwtService,
  ) {}

  @ApiBearerAuth()
  @Get('mine')
  async mine(@Headers('authorization') authorization: string | undefined) {
    const user = await requireUserId(this.jwt, authorization);
    return this.ads.listMine(user.sub);
  }

  @ApiBearerAuth()
  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.ads.createDraft(user.sub, body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.ads.getById(id);
  }

  @ApiBearerAuth()
  @Post(':id/submit-review')
  async submitReview(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.ads.submitReview(id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/revisions')
  async revise(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.ads.createRevision(id, user.sub, body);
  }
}
