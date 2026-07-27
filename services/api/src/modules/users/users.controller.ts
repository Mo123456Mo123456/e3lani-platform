import { Body, Controller, Get, Headers, Patch } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { updateProfileSchema } from '@e3lani/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { requireActiveUser } from '../../common/auth.util';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    return this.users.getById(user.sub);
  }

  @Patch('me')
  async updateMe(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    const input = updateProfileSchema.parse(body);
    return this.users.updateProfile(user.sub, input);
  }
}
