import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Worker, type Job } from "bullmq";
import { config as loadEnvironment } from "dotenv";
import ffmpegStatic from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { fileTypeFromBuffer } from "file-type";
import { Redis } from "ioredis";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

import { prisma } from "@e3lani/database";

loadEnvironment({
  path: [resolve(process.cwd(), "../../.env"), resolve(process.cwd(), ".env")],
  quiet: true,
});

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const ffmpegPath = ffmpegStatic as unknown as string | null;
const bucket = process.env.S3_BUCKET!;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

async function objectBuffer(key: string) {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new Error("SOURCE_OBJECT_EMPTY");
  return Buffer.from(await object.Body.transformToByteArray());
}

async function put(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const process = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let error = "";
    process.stdout.on("data", (chunk) => (output += String(chunk)));
    process.stderr.on("data", (chunk) => (error += String(chunk)));
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} exited ${code}: ${error.slice(-2_000)}`));
    });
  });
}

async function processImage(mediaId: string) {
  const media = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
  const source = await objectBuffer(media.sourceKey);
  const detected = await fileTypeFromBuffer(source);
  if (!detected || !["image/jpeg", "image/png", "image/webp"].includes(detected.mime)) {
    throw new Error("IMAGE_SIGNATURE_NOT_ALLOWED");
  }
  const image = sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("IMAGE_DIMENSIONS_MISSING");
  const normalized =
    media.purpose === "AVATAR" || media.purpose === "LOGO"
      ? image.clone().resize(1080, 1080, { fit: "cover", position: "attention" })
      : image;
  const thumbnail = await normalized
    .clone()
    .resize(320, 320, { fit: "cover" })
    .webp({ quality: 76 })
    .toBuffer();
  const optimized = await normalized
    .clone()
    .resize({ width: 1440, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  const medium = await normalized
    .clone()
    .resize({ width: 720, height: 960, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const thumbnailKey = `processed/${media.id}/thumb.webp`;
  const mediumKey = `processed/${media.id}/medium.webp`;
  const optimizedKey = `processed/${media.id}/full.webp`;
  await Promise.all([
    put(thumbnailKey, thumbnail, "image/webp"),
    put(mediumKey, medium, "image/webp"),
    put(optimizedKey, optimized, "image/webp"),
  ]);
  await prisma.mediaAsset.update({
    where: { id: media.id },
    data: {
      status: "READY",
      thumbnailKey,
      mediumKey,
      optimizedKey,
      width: metadata.width,
      height: metadata.height,
      moderationResult: "SAFE",
      processingError: null,
    },
  });
}

async function processVideo(mediaId: string) {
  const media = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
  const source = await objectBuffer(media.sourceKey);
  const detected = await fileTypeFromBuffer(source);
  if (!detected || !["video/mp4", "video/quicktime"].includes(detected.mime)) {
    throw new Error("VIDEO_SIGNATURE_NOT_ALLOWED");
  }
  const directory = await mkdtemp(join(tmpdir(), "e3lani-media-"));
  const input = join(directory, detected.mime === "video/quicktime" ? "input.mov" : "input.mp4");
  const output = join(directory, "output.mp4");
  const poster = join(directory, "poster.webp");
  try {
    await writeFile(input, source);
    const probeOutput = await run(ffprobe.path, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      input,
    ]);
    const probe = JSON.parse(probeOutput) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const durationSeconds = Number(probe.format?.duration);
    const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60) {
      throw new Error("VIDEO_DURATION_EXCEEDS_60_SECONDS");
    }
    const executable = process.env.FFMPEG_PATH || ffmpegPath;
    if (!executable) throw new Error("FFMPEG_NOT_AVAILABLE");
    await run(executable, [
      "-y",
      "-i",
      input,
      "-vf",
      "scale='min(1080,iw)':-2:force_original_aspect_ratio=decrease",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-t",
      "60",
      output,
    ]);
    await run(executable, [
      "-y",
      "-ss",
      String(Math.min(1, durationSeconds / 2)),
      "-i",
      output,
      "-frames:v",
      "1",
      "-vf",
      "scale=720:-2",
      poster,
    ]);
    const [videoBuffer, posterBuffer] = await Promise.all([readFile(output), readFile(poster)]);
    const optimizedKey = `processed/${media.id}/video.mp4`;
    const thumbnailKey = `processed/${media.id}/poster.webp`;
    await Promise.all([
      put(optimizedKey, videoBuffer, "video/mp4"),
      put(thumbnailKey, posterBuffer, "image/webp"),
    ]);
    await prisma.mediaAsset.update({
      where: { id: media.id },
      data: {
        status: "READY",
        optimizedKey,
        thumbnailKey,
        width: videoStream?.width,
        height: videoStream?.height,
        durationSeconds,
        moderationResult: "SAFE",
        processingError: null,
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function handle(job: Job<{ mediaId: string }>) {
  await prisma.mediaAsset.update({
    where: { id: job.data.mediaId },
    data: { status: "PROCESSING", processingError: null },
  });
  if (job.name === "process-image") return processImage(job.data.mediaId);
  if (job.name === "process-video") return processVideo(job.data.mediaId);
  throw new Error(`UNKNOWN_MEDIA_JOB:${job.name}`);
}

const worker = new Worker(process.env.MEDIA_QUEUE_NAME ?? "media-processing", handle, {
  connection,
  concurrency: Number(process.env.MEDIA_WORKER_CONCURRENCY ?? 2),
});

worker.on("completed", (job) => console.info(`Media job ${job.id} completed`));
worker.on("failed", async (job, error) => {
  console.error(`Media job ${job?.id} failed`, error);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.mediaAsset.update({
      where: { id: job.data.mediaId },
      data: { status: "FAILED", processingError: error.message.slice(0, 1_000) },
    });
  }
});

async function shutdown() {
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
