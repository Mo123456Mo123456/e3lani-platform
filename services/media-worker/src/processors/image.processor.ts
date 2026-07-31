import sharp from 'sharp';
import { MEDIA_LIMITS } from '@e3lani/config';
import { uploadBuffer } from '../lib/storage';
import { replaceExtension } from '../lib/media-rules';
import { logger } from '../lib/logger';

export interface ProcessedImage {
  playbackKey: string;
  thumbnailKey: string;
  variants: { name: string; key: string; width: number; height: number }[];
  width: number;
  height: number;
  sizeBytes: number;
  placeholder: string | null;
}

/**
 * ضغط وتحسين تلقائي للصور:
 *  - تصحيح الدوران حسب EXIF وإزالة البيانات الوصفية
 *  - نسخ متعددة المقاسات (thumb / medium / large) بصيغة WebP
 *  - صورة مصغّرة جدًا تُستخدم كـ Placeholder أثناء التحميل التدريجي
 *  - يحافظ على نسبة العرض إلى الارتفاع (عمودي / مربع / أفقي) دون تشويه
 */
export async function processImage(sourcePath: string, key: string): Promise<ProcessedImage> {
  const base = sharp(sourcePath, { failOn: 'none' }).rotate();
  const metadata = await base.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) throw new Error('IMAGE_METADATA_UNREADABLE');

  const variants: ProcessedImage['variants'] = [];
  let playbackKey = key;
  let playbackSize = 0;

  for (const variant of MEDIA_LIMITS.imageVariants) {
    const targetWidth = Math.min(variant.width, width);
    const buffer = await sharp(sourcePath, { failOn: 'none' })
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    const variantKey = replaceExtension(key, variant.name, 'webp');
    await uploadBuffer(variantKey, buffer.data, 'image/webp');

    variants.push({
      name: variant.name,
      key: variantKey,
      width: buffer.info.width,
      height: buffer.info.height,
    });

    if (variant.name === 'large' || variants.length === MEDIA_LIMITS.imageVariants.length) {
      playbackKey = variantKey;
      playbackSize = buffer.info.size;
    }
  }

  const thumbnail = variants.find((variant) => variant.name === 'thumb') ?? variants[0]!;

  let placeholder: string | null = null;
  try {
    const tiny = await sharp(sourcePath, { failOn: 'none' })
      .rotate()
      .resize({ width: 24 })
      .webp({ quality: 40 })
      .toBuffer();
    placeholder = `data:image/webp;base64,${tiny.toString('base64')}`;
  } catch (error) {
    logger.warn('image', 'تعذّر توليد صورة العنصر النائب', { error: (error as Error).message });
  }

  return {
    playbackKey,
    thumbnailKey: thumbnail.key,
    variants,
    width,
    height,
    sizeBytes: playbackSize,
    placeholder,
  };
}
