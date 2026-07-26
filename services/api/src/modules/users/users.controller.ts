import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('MISSING_TOKEN');
    }
    const token = authorization.slice('Bearer '.length);
    const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
    return this.users.getById(payload.sub);
  }
}
