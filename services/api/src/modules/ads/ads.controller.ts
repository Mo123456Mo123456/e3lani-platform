import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdsService } from './ads.service';

@ApiTags('ads')
@Controller('ads')
export class AdsController {
  constructor(
    private readonly ads: AdsService,
    private readonly jwt: JwtService,
  ) {}

  private async userId(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('MISSING_TOKEN');
    }
    const payload = await this.jwt.verifyAsync<{ sub: string }>(
      authorization.slice('Bearer '.length),
    );
    return payload.sub;
  }

  @ApiBearerAuth()
  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    const ownerId = await this.userId(authorization);
    return this.ads.createDraft(ownerId, body);
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
    const ownerId = await this.userId(authorization);
    return this.ads.submitReview(id, ownerId);
  }

  @ApiBearerAuth()
  @Post(':id/revisions')
  async revise(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const ownerId = await this.userId(authorization);
    return this.ads.createRevision(id, ownerId, body);
  }
}
