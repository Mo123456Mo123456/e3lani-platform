import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaKind } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';

const createPostSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  contactMethods: z.record(z.any()).optional(),
  mediaAssetIds: z.array(z.string().uuid()).max(5).optional(),
});

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByOwner(ownerId: string) {
    return this.prisma.profilePost.findMany({
      where: { ownerId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async listMine(ownerId: string) {
    return this.prisma.profilePost.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async getById(id: string) {
    const post = await this.prisma.profilePost.findUnique({
      where: { id },
      include: {
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
        owner: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            accountType: true,
            brandProfile: true,
          },
        },
      },
    });
    if (!post || post.deletedAt) throw new NotFoundException('POST_NOT_FOUND');
    return post;
  }

  async create(ownerId: string, body: unknown) {
    const input = createPostSchema.parse(body);
    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.profilePost.create({
        data: {
          ownerId,
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          cityId: input.cityId,
          contactMethods: input.contactMethods ?? undefined,
          status: 'ACTIVE',
        },
      });

      if (input.mediaAssetIds?.length) {
        const assets = await tx.mediaAsset.findMany({
          where: { id: { in: input.mediaAssetIds }, ownerId },
        });
        if (assets.length !== input.mediaAssetIds.length) {
          throw new BadRequestException('MEDIA_ASSET_INVALID');
        }
        await tx.profilePostMedia.createMany({
          data: input.mediaAssetIds.map((assetId, index) => {
            const asset = assets.find((row) => row.id === assetId)!;
            return {
              postId: created.id,
              assetId,
              sortOrder: index,
              kind: asset.kind as MediaKind,
            };
          }),
        });
      }

      return tx.profilePost.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    await this.audit.write({
      actorId: ownerId,
      action: 'posts.create',
      entityType: 'profile_post',
      entityId: post.id,
      after: { title: post.title },
    });

    return post;
  }

  async update(id: string, ownerId: string, body: unknown) {
    const existing = await this.getOwned(id, ownerId);
    const input = createPostSchema.partial().parse(body);
    const updated = await this.prisma.profilePost.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        cityId: input.cityId,
        contactMethods: input.contactMethods ?? undefined,
      },
      include: {
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    await this.audit.write({
      actorId: ownerId,
      action: 'posts.update',
      entityType: 'profile_post',
      entityId: id,
    });
    return updated;
  }

  async remove(id: string, ownerId: string) {
    await this.getOwned(id, ownerId);
    const updated = await this.prisma.profilePost.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'REMOVED' },
    });
    await this.audit.write({
      actorId: ownerId,
      action: 'posts.delete',
      entityType: 'profile_post',
      entityId: id,
    });
    return updated;
  }

  async save(postId: string, userId: string) {
    await this.getById(postId);
    return this.prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
  }

  async unsave(postId: string, userId: string) {
    await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
    return { ok: true };
  }

  async share(postId: string, userId?: string) {
    await this.getById(postId);
    await this.prisma.analyticsEvent.create({
      data: { name: 'post.share', userId, payload: { postId } },
    });
    const baseUrl = (process.env.PUBLIC_WEB_URL ?? process.env.APP_URL ?? 'https://e3lani.com').replace(
      /\/$/,
      '',
    );
    return { ok: true, shareUrl: `${baseUrl}/posts/${postId}` };
  }

  private async getOwned(id: string, ownerId: string) {
    const post = await this.prisma.profilePost.findUnique({ where: { id } });
    if (!post || post.deletedAt) throw new NotFoundException('POST_NOT_FOUND');
    if (post.ownerId !== ownerId) throw new ForbiddenException();
    return post;
  }
}
