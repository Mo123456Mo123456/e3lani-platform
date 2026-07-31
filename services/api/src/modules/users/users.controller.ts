import { Body, Controller, Delete, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { updateBusinessProfileSchema, updateProfileSchema } from '@e3lani/types';
import { UsersService } from './users.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../../common/decorators';

@ApiTags('me')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch()
  async updateProfile(@CurrentUser() user: AuthUser, @Body(zodPipe(updateProfileSchema)) body: any) {
    return this.users.updateProfile(user.id, body);
  }

  @Patch('business')
  async updateBusiness(
    @CurrentUser() user: AuthUser,
    @Body(zodPipe(updateBusinessProfileSchema)) body: any,
  ) {
    return this.users.updateBusinessProfile(user.id, body);
  }

  @Delete()
  async deleteAccount(@CurrentUser() user: AuthUser) {
    await this.users.deleteAccount(user.id);
    return { deleted: true };
  }
}
