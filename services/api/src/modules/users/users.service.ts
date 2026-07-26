import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { brandProfile: true, verification: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('USER_NOT_FOUND');
    return user;
  }
}
