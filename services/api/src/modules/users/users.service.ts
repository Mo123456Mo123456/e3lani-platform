import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateProfileInput } from '@e3lani/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { brandProfile: true, verification: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('USER_NOT_FOUND');
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        locale: true,
        cityId: true,
        avatarUrl: true,
        deletedAt: true,
      },
    });
    if (!before || before.deletedAt) throw new NotFoundException('USER_NOT_FOUND');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
        email: input.email,
        locale: input.locale,
        cityId: input.cityId,
        avatarUrl: input.avatarUrl,
      },
      include: { brandProfile: true, verification: true },
    });

    await this.audit.write({
      actorId: userId,
      action: 'users.profile_update',
      entityType: 'user',
      entityId: userId,
      before: {
        displayName: before.displayName,
        email: before.email,
        locale: before.locale,
        cityId: before.cityId,
        avatarUrl: before.avatarUrl,
      },
      after: {
        displayName: updated.displayName,
        email: updated.email,
        locale: updated.locale,
        cityId: updated.cityId,
        avatarUrl: updated.avatarUrl,
      },
    });

    return updated;
  }
}
