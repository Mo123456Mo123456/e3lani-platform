import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parseServerEnv } from "@e3lani/config";
import { prisma } from "@e3lani/database";

const exec = promisify(execFile);
const env = parseServerEnv();
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
});

export function detectMedia(buffer: Buffer): "jpeg" | "png" | "webp" | "mp4" | "mov" | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    return ["qt  "].includes(brand) ? "mov" : "mp4";
  }
  return null;
}

async function put(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

async function processImage(assetId: string, input: Buffer) {
  const image = sharp(input, { failOn: "error" }).rotate();
  const metadata = await image.metadata();
  const optimized = await image
    .clone()
    .resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  const thumbnail = await image
    .clone()
    .resize({ width: 480, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer();
  const optimizedKey = `processed/${assetId}/image.webp`;
  const thumbnailKey = `processed/${assetId}/thumbnail.webp`;
  await Promise.all([
    put(optimizedKey, optimized, "image/webp"),
    put(thumbnailKey, thumbnail, "image/webp")
  ]);
  return {
    optimizedKey,
    thumbnailKey,
    width: metadata.width,
    height: metadata.height,
    durationMs: null
  };
}

async function processVideo(assetId: string, input: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), "e3lani-media-"));
  const original = join(directory, "input");
  const output = join(directory, "output.mp4");
  const thumbnail = join(directory, "thumbnail.jpg");
  try {
    await writeFile(original, input);
    const probe = await exec("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=width,height",
      "-of",
      "json",
      original
    ]);
    const metadata = JSON.parse(probe.stdout) as {
      format?: { duration?: string };
      streams?: Array<{ width?: number; height?: number }>;
    };
    const duration = Number(metadata.format?.duration ?? 0);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60) {
      throw new Error("VIDEO_DURATION_INVALID");
    }
    await exec("ffmpeg", [
      "-y",
      "-i",
      original,
      "-map_metadata",
      "-1",
      "-vf",
      "scale='min(1080,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "24",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      output
    ]);
    await exec("ffmpeg", ["-y", "-ss", "00:00:01", "-i", output, "-frames:v", "1", thumbnail]);
    const [videoBuffer, thumbnailBuffer] = await Promise.all([readFile(output), readFile(thumbnail)]);
    const optimizedKey = `processed/${assetId}/video.mp4`;
    const thumbnailKey = `processed/${assetId}/thumbnail.jpg`;
    await Promise.all([
      put(optimizedKey, videoBuffer, "video/mp4"),
      put(thumbnailKey, thumbnailBuffer, "image/jpeg")
    ]);
    return {
      optimizedKey,
      thumbnailKey,
      width: metadata.streams?.[0]?.width ?? null,
      height: metadata.streams?.[0]?.height ?? null,
      durationMs: Math.round(duration * 1000)
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function processAsset(assetId: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || !["QUEUED", "FAILED"].includes(asset.status)) return;
  await prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: "PROCESSING" } });
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: asset.originalKey })
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error("MEDIA_OBJECT_EMPTY");
    const input = Buffer.from(bytes);
    const detected = detectMedia(input);
    const allowed =
      asset.kind === "IMAGE"
        ? ["jpeg", "png", "webp"].includes(detected ?? "")
        : ["mp4", "mov"].includes(detected ?? "");
    if (!allowed) throw new Error("MEDIA_SIGNATURE_INVALID");
    const result =
      asset.kind === "IMAGE"
        ? await processImage(asset.id, input)
        : await processVideo(asset.id, input);
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { ...result, status: "READY", moderation: "SAFE", rejectionCode: null }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MEDIA_PROCESSING_FAILED";
    const terminal = ["VIDEO_DURATION_INVALID", "MEDIA_SIGNATURE_INVALID"].includes(message);
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: terminal ? "REJECTED" : "FAILED",
        moderation: terminal ? "BLOCKED" : null,
        rejectionCode: message.slice(0, 100)
      }
    });
    throw error;
  }
}

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker<{ assetId: string }>(
  "media-processing",
  async (job) => processAsset(job.data.assetId),
  { connection, concurrency: 2 }
);

worker.on("completed", (job) => console.info(`Processed media ${job.data.assetId}`));
worker.on("failed", (job, error) =>
  console.error(`Media ${job?.data.assetId ?? "unknown"} failed`, error)
);

async function shutdown() {
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
