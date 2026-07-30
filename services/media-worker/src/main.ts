import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Worker } from "bullmq";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { fileTypeFromBuffer } from "file-type";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

import { prisma } from "@e3lani/database";

const exec = promisify(execFile);
const bucket = process.env.S3_BUCKET ?? "e3lani-media";
const endpoint = (process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

function redisConnection() {
  const redis = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: redis.hostname,
    port: Number(redis.port || 6379),
    username: redis.username || undefined,
    password: redis.password || undefined,
  };
}

function publicUrl(key: string) {
  return `${endpoint}/${bucket}/${key}`;
}

async function download(key: string) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error("MEDIA_OBJECT_EMPTY");
  return Buffer.from(await response.Body.transformToByteArray());
}

async function upload(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicUrl(key);
}

async function processImage(mediaId: string, originalKey: string, input: Buffer) {
  const detected = await fileTypeFromBuffer(input);
  if (!detected || !["image/jpeg", "image/png", "image/webp"].includes(detected.mime)) {
    throw new Error("IMAGE_SIGNATURE_INVALID");
  }
  const source = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await source.metadata();
  const widths = [
    ["small", 480],
    ["medium", 1080],
    ["large", 1600],
  ] as const;
  const variants: Record<string, string> = {};
  for (const [name, width] of widths) {
    const output = await source
      .clone()
      .resize({ width, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    const key = originalKey.replace(/original\.[^.]+$/, `${name}.webp`);
    variants[name] = await upload(key, output, "image/webp");
  }
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: {
      status: "READY",
      width: metadata.width,
      height: metadata.height,
      variants,
      thumbnailUrl: variants.small,
    },
  });
}

async function probeDuration(path: string) {
  const { stdout } = await exec(ffprobe.path, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds)) throw new Error("VIDEO_DURATION_INVALID");
  return seconds;
}

async function processVideo(mediaId: string, originalKey: string, input: Buffer) {
  const detected = await fileTypeFromBuffer(input);
  if (!detected || !["video/mp4", "video/quicktime"].includes(detected.mime)) {
    throw new Error("VIDEO_SIGNATURE_INVALID");
  }
  if (!ffmpegPath) throw new Error("FFMPEG_NOT_AVAILABLE");
  const directory = await mkdtemp(join(tmpdir(), "e3lani-media-"));
  const inputPath = join(directory, detected.mime === "video/quicktime" ? "input.mov" : "input.mp4");
  const outputPath = join(directory, "optimized.mp4");
  const thumbnailPath = join(directory, "thumbnail.webp");
  try {
    await writeFile(inputPath, input);
    const seconds = await probeDuration(inputPath);
    if (seconds > 60.05) throw new Error("VIDEO_DURATION_EXCEEDS_60_SECONDS");
    await exec(
      ffmpegPath,
      [
        "-y",
        "-i",
        inputPath,
        "-vf",
        "scale=min(1080\\,iw):-2",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "25",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        outputPath,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    await exec(ffmpegPath, [
      "-y",
      "-ss",
      String(Math.min(1, seconds / 2)),
      "-i",
      outputPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=480:-2",
      thumbnailPath,
    ]);
    const optimizedKey = originalKey.replace(/original\.[^.]+$/, "optimized.mp4");
    const thumbnailKey = originalKey.replace(/original\.[^.]+$/, "thumbnail.webp");
    const [optimizedUrl, thumbnailUrl] = await Promise.all([
      upload(optimizedKey, await readFile(outputPath), "video/mp4"),
      upload(thumbnailKey, await readFile(thumbnailPath), "image/webp"),
    ]);
    await prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        status: "READY",
        durationMs: Math.round(seconds * 1000),
        variants: { optimized: optimizedUrl },
        thumbnailUrl,
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const worker = new Worker<{ mediaId: string }>(
  "media-processing",
  async (job) => {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: job.data.mediaId } });
    if (!asset) throw new Error("MEDIA_ASSET_NOT_FOUND");
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: "PROCESSING", failureReason: null },
    });
    try {
      const input = await download(asset.originalKey);
      if (input.byteLength !== asset.bytes) throw new Error("MEDIA_SIZE_MISMATCH");
      if (asset.kind === "IMAGE") {
        await processImage(asset.id, asset.originalKey, input);
      } else {
        await processVideo(asset.id, asset.originalKey, input);
      }
    } catch (error) {
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: "FAILED",
          failureReason: error instanceof Error ? error.message.slice(0, 500) : "PROCESSING_FAILED",
        },
      });
      throw error;
    }
  },
  { connection: redisConnection(), concurrency: Number(process.env.MEDIA_WORKER_CONCURRENCY ?? 2) },
);

worker.on("ready", () => console.info("E3lani media worker is ready"));
worker.on("failed", (job, error) => console.error("Media job failed", job?.id, error));

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
