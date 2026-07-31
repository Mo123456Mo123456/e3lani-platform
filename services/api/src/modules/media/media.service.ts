import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MEDIA_LIMITS } from '@e3lani/config';
import type { MediaDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { QueueService } from '../../common/services/queue.service';
import { SerializerService } from '../../common/services/serializer.service';

type Purpose = 'AD' | 'POST' | 'AVATAR' | 'LOGO' | 'COVER' | 'TICKER_LOGO';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly serializer: SerializerService,
    private readonly config: ConfigService,
  ) {}

  /**
   * الفحص الآلي أثناء الرفع: نوع الملف والحجم والوجهة.
   * يُنشئ سجل الوسيط ويعيد رابط رفع موقّعًا مباشرًا إلى التخزين.
   */
  async createUpload(
    userId: string,
    input: { type: 'IMAGE' | 'VIDEO'; mimeType: string; sizeBytes: number; purpose: Purpose; fileName?: string },
  ) {
    const allowedImages = MEDIA_LIMITS.allowedImageMime as readonly string[];
    const allowedVideos = MEDIA_LIMITS.allowedVideoMime as readonly string[];
    const isImage = input.type === 'IMAGE';
    const allowed = isImage ? allowedImages : allowedVideos;

    if (!allowed.includes(input.mimeType)) {
      throw new BadRequestException({
        message: isImage
          ? 'صيغة الصورة غير مدعومة (JPG / PNG / WebP فقط)'
          : 'صيغة الفيديو غير مدعومة (MP4 / MOV فقط)',
        code: 'MEDIA_TYPE_UNSUPPORTED',
      });
    }

    if (!isImage && ['AVATAR', 'LOGO', 'COVER', 'TICKER_LOGO'].includes(input.purpose)) {
      throw new BadRequestException({
        message: 'هذه الوجهة تقبل الصور فقط',
        code: 'MEDIA_PURPOSE_INVALID',
      });
    }

    const maxBytes = isImage
      ? (this.config.get<number>('MEDIA_MAX_IMAGE_BYTES') ?? MEDIA_LIMITS.maxImageBytes)
      : (this.config.get<number>('MEDIA_MAX_VIDEO_BYTES') ?? MEDIA_LIMITS.maxVideoBytes);

    if (input.sizeBytes > maxBytes) {
      throw new BadRequestException({
        message: `حجم الملف يتجاوز الحد المسموح (${Math.round(maxBytes / 1024 / 1024)} ميجابايت)`,
        code: 'MEDIA_TOO_LARGE',
      });
    }

    const extension = EXTENSIONS[input.mimeType] ?? 'bin';
    const key = this.storage.buildKey(userId, input.purpose, extension);

    const media = await this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        type: input.type,
        purpose: input.purpose,
        status: 'PENDING',
        originalKey: key,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });

    const upload = await this.storage.createUploadUrl(key, input.mimeType);

    return {
      mediaId: media.id,
      uploadUrl: upload.uploadUrl,
      key: upload.key,
      headers: upload.headers,
      expiresIn: upload.expiresIn,
      maxVideoSeconds: this.config.get<number>('MEDIA_MAX_VIDEO_SECONDS') ?? MEDIA_LIMITS.maxVideoSeconds,
    };
  }

  /** يؤكد وصول الملف للتخزين ويجدول المعالجة (ضغط/تحسين/مصغّرة). */
  async completeUpload(userId: string, mediaId: string) {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, ownerId: userId },
    });
    if (!media) throw new NotFoundException({ message: 'الوسيط غير موجود', code: 'MEDIA_NOT_FOUND' });
    if (media.status !== 'PENDING') return this.toDto(media.id);

    const head = await this.storage.head(media.originalKey);
    if (!head) {
      throw new BadRequestException({
        message: 'لم يصل الملف إلى التخزين، أعد المحاولة',
        code: 'MEDIA_NOT_UPLOADED',
      });
    }

    const maxBytes =
      media.type === 'IMAGE'
        ? (this.config.get<number>('MEDIA_MAX_IMAGE_BYTES') ?? MEDIA_LIMITS.maxImageBytes)
        : (this.config.get<number>('MEDIA_MAX_VIDEO_BYTES') ?? MEDIA_LIMITS.maxVideoBytes);

    if (head.size > maxBytes) {
      await this.storage.delete(media.originalKey);
      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: { status: 'FAILED', error: 'MEDIA_TOO_LARGE' },
      });
      throw new BadRequestException({
        message: 'حجم الملف المرفوع يتجاوز الحد المسموح',
        code: 'MEDIA_TOO_LARGE',
      });
    }

    await this.prisma.mediaAsset.update({
      where: { id: media.id },
      data: { status: 'PROCESSING', sizeBytes: head.size },
    });

    await this.queue.enqueueMediaProcessing({
      mediaId: media.id,
      key: media.originalKey,
      type: media.type,
      purpose: media.purpose,
    });

    return this.toDto(media.id);
  }

  async toDto(mediaId: string): Promise<MediaDto> {
    const media = await this.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
    return this.serializer.media(media as any)!;
  }

  async get(userId: string, mediaId: string): Promise<MediaDto> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, ownerId: userId },
    });
    if (!media) throw new NotFoundException({ message: 'الوسيط غير موجود', code: 'MEDIA_NOT_FOUND' });
    return this.serializer.media(media as any)!;
  }

  async remove(userId: string, mediaId: string): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, ownerId: userId },
      include: { adMedia: true, postMedia: true },
    });
    if (!media) throw new NotFoundException({ message: 'الوسيط غير موجود', code: 'MEDIA_NOT_FOUND' });
    if (media.adMedia.length || media.postMedia.length) {
      throw new BadRequestException({
        message: 'لا يمكن حذف وسيط مرتبط بإعلان أو منشور',
        code: 'MEDIA_IN_USE',
      });
    }
    await this.storage.delete(media.originalKey);
    if (media.playbackKey && media.playbackKey !== media.originalKey) {
      await this.storage.delete(media.playbackKey);
    }
    if (media.thumbnailKey) await this.storage.delete(media.thumbnailKey);
    await this.prisma.mediaAsset.delete({ where: { id: media.id } });
  }

  /**
   * يتحقق من ملكية الوسائط وصلاحيتها قبل ربطها بإعلان أو منشور.
   * يمنع تجاوز الحدود: صورة إلى ٥ صور، أو فيديو واحد فقط.
   */
  async assertUsableMedia(
    userId: string,
    mediaIds: string[],
    purpose: Purpose,
  ): Promise<{ id: string; type: string }[]> {
    const media = await this.prisma.mediaAsset.findMany({
      where: { id: { in: mediaIds }, ownerId: userId },
      select: { id: true, type: true, status: true, purpose: true },
    });

    if (media.length !== mediaIds.length) {
      throw new BadRequestException({ message: 'بعض الوسائط غير موجودة', code: 'MEDIA_NOT_FOUND' });
    }
    if (media.some((item) => item.status === 'FAILED')) {
      throw new BadRequestException({
        message: 'فشل فحص أحد الملفات، احذفه وأعد رفعه',
        code: 'MEDIA_FAILED',
      });
    }
    if (media.some((item) => item.purpose !== purpose)) {
      throw new BadRequestException({ message: 'وسيط مرفوع لوجهة أخرى', code: 'MEDIA_PURPOSE_MISMATCH' });
    }

    const videos = media.filter((item) => item.type === 'VIDEO');
    const images = media.filter((item) => item.type === 'IMAGE');

    if (videos.length > 1) {
      throw new BadRequestException({ message: 'يُسمح بفيديو واحد فقط', code: 'MEDIA_TOO_MANY_VIDEOS' });
    }
    if (videos.length === 1 && images.length > 0) {
      throw new BadRequestException({
        message: 'اختر إما فيديو واحدًا أو صورًا، وليس الاثنين معًا',
        code: 'MEDIA_MIXED',
      });
    }
    const maxImages = this.config.get<number>('MEDIA_MAX_IMAGES_PER_AD') ?? MEDIA_LIMITS.maxImagesPerAd;
    if (images.length > maxImages) {
      throw new BadRequestException({
        message: `الحد الأقصى ${maxImages} صور`,
        code: 'MEDIA_TOO_MANY_IMAGES',
      });
    }

    // ترتيب الوسائط كما أرسلها المستخدم
    return mediaIds.map((id) => media.find((item) => item.id === id)!);
  }
}
