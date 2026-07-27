import { Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { requireUserId } from '../../common/auth.util';
import { SavedService } from './saved.service';

@ApiTags('saved')
@ApiBearerAuth()
@Controller()
export class SavedController {
  constructor(
    private readonly saved: SavedService,
    private readonly jwt: JwtService,
  ) {}

  @Get('saved')
  async list(@Headers('authorization') authorization?: string) {
    const user = await requireUserId(this.jwt, authorization);
    return this.saved.list(user.sub);
  }

  @Post('ads/:id/save')
  async save(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.saved.save(user.sub, id);
  }

  @Delete('ads/:id/save')
  async unsave(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user = await requireUserId(this.jwt, authorization);
    return this.saved.unsave(user.sub, id);
  }
}
