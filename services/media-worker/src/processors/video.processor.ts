import { stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { config } from '../config';
import { cleanup, uploadFile } from '../lib/storage';
import { isDurationAllowed, renditionsFor, replaceExtension } from '../lib/media-rules';
import { logger } from '../lib/logger';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);
if (ffprobeStatic?.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

export interface ProcessedVideo {
  playbackKey: string;
  thumbnailKey: string;
  variants: { name: string; key: string; width: number; height: number }[];
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
}

interface Probe {
  durationSeconds: number;
  width: number;
  height: number;
}

export function probeVideo(path: string): Promise<Probe> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (error, data) => {
      if (error) {
        reject(new Error('VIDEO_PROBE_FAILED'));
        return;
      }
      const stream = data.streams.find((item) => item.codec_type === 'video');
      if (!stream) {
        reject(new Error('VIDEO_STREAM_MISSING'));
        return;
      }
      resolve({
        durationSeconds: Number(data.format.duration ?? 0),
        width: Number(stream.width ?? 0),
        height: Number(stream.height ?? 0),
      });
    });
  });
}

function transcode(source: string, target: string, height: number, bitrate: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(source)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('128k')
      .videoBitrate(bitrate)
      // يحافظ على نسبة العرض إلى الارتفاع ويجعل الأبعاد زوجية (مطلوب لـ H.264)
      .outputOptions([
        '-preset veryfast',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-profile:v main',
        `-vf scale=-2:'min(${height},ih)'`,
      ])
      .format('mp4')
      .on('error', (error) => reject(new Error(`VIDEO_TRANSCODE_FAILED: ${error.message}`)))
      .on('end', () => resolve())
      .save(target);
  });
}

function captureThumbnail(source: string, target: string, atSecond: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(source)
      .screenshots({
        timestamps: [Math.max(0, atSecond).toFixed(2)],
        filename: target.split('/').pop()!,
        folder: target.substring(0, target.lastIndexOf('/')),
        size: '720x?',
      })
      .on('error', (error) => reject(new Error(`THUMBNAIL_FAILED: ${error.message}`)))
      .on('end', () => resolve());
  });
}

/**
 * معالجة الفيديو:
 *  - يرفض أي فيديو يتجاوز الحد المسموح (٦٠ ثانية افتراضيًا) — فحص آلي
 *  - نسخ 720p و480p بصيغة MP4/H.264 مع faststart للتشغيل التدريجي
 *  - صورة مصغّرة تلقائية للفيديو
 */
export async function processVideo(sourcePath: string, key: string): Promise<ProcessedVideo> {
  const probe = await probeVideo(sourcePath);

  if (!isDurationAllowed(probe.durationSeconds, config.media.maxVideoSeconds)) {
    throw new Error('VIDEO_TOO_LONG');
  }
  if (!probe.width || !probe.height) throw new Error('VIDEO_METADATA_UNREADABLE');

  const temporaries: string[] = [];
  const variants: ProcessedVideo['variants'] = [];
  let playbackKey = key;
  let playbackSize = 0;

  try {
    for (const rendition of renditionsFor(probe.height)) {
      const output = join(tmpdir(), `e3lani-${randomUUID()}-${rendition.name}.mp4`);
      temporaries.push(output);
      await transcode(sourcePath, output, rendition.height, rendition.bitrate);

      const variantKey = replaceExtension(key, rendition.name, 'mp4');
      await uploadFile(variantKey, output, 'video/mp4');
      const stats = await stat(output);
      const scale = Math.min(1, rendition.height / probe.height);

      variants.push({
        name: rendition.name,
        key: variantKey,
        width: Math.round(probe.width * scale),
        height: Math.round(probe.height * scale),
      });

      if (rendition.name === '720p' || !playbackSize) {
        playbackKey = variantKey;
        playbackSize = stats.size;
      }
    }

    const thumbnailPath = join(tmpdir(), `e3lani-${randomUUID()}-thumb.jpg`);
    temporaries.push(thumbnailPath);
    await captureThumbnail(sourcePath, thumbnailPath, Math.min(1, probe.durationSeconds / 2));
    const thumbnailKey = replaceExtension(key, 'thumb', 'jpg');
    await uploadFile(thumbnailKey, thumbnailPath, 'image/jpeg');

    return {
      playbackKey,
      thumbnailKey,
      variants,
      width: probe.width,
      height: probe.height,
      durationMs: Math.round(probe.durationSeconds * 1000),
      sizeBytes: playbackSize,
    };
  } finally {
    await cleanup(...temporaries);
    logger.debug('video', 'تم تنظيف الملفات المؤقتة');
  }
}
