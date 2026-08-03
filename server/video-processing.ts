import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROCESS_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 120 * 1024 * 1024;
const FFMPEG = process.env.FFMPEG_PATH?.trim() || "/usr/bin/ffmpeg";
const FONT_FILE = process.env.VIDEO_FONT_PATH?.trim() || "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

export async function assertVideoProcessingAvailable(): Promise<void> {
  await access(FFMPEG, constants.X_OK).catch(() => {
    throw new Error("VIDEO_PROCESSING_UNAVAILABLE");
  });
  await access(FONT_FILE, constants.R_OK).catch(() => {
    throw new Error("VIDEO_FONT_UNAVAILABLE");
  });
}

async function runFfmpeg(args: string[]): Promise<void> {
  await assertVideoProcessingAvailable();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 8_000) stderr += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("VIDEO_PROCESSING_TIMEOUT"));
    }, PROCESS_TIMEOUT_MS);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("VIDEO_PROCESSING_UNAVAILABLE"));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr ? "VIDEO_PROCESSING_FAILED" : "VIDEO_PROCESSING_FAILED"));
    });
  });
}

async function withVideoWorkspace<T>(
  source: Buffer,
  operation: (paths: { input: string; output: string; watermark: string }) => Promise<T>,
): Promise<T> {
  if (!source.length || source.length > MAX_SOURCE_BYTES) throw new Error("VIDEO_SOURCE_SIZE_INVALID");
  const directory = await mkdtemp(join(tmpdir(), "e3lani-video-"));
  const paths = {
    input: join(directory, "input.mp4"),
    output: join(directory, "output.mp4"),
    watermark: join(directory, "watermark.txt"),
  };
  try {
    await writeFile(paths.input, source, { mode: 0o600 });
    return await operation(paths);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function createVideoPoster(source: Buffer): Promise<Buffer> {
  return withVideoWorkspace(source, async ({ input, output }) => {
    const poster = output.replace(/\.mp4$/, ".jpg");
    await runFfmpeg([
      "-ss", "0.1", "-i", input, "-frames:v", "1",
      "-vf", "scale=1200:1200:force_original_aspect_ratio=decrease,pad=1200:1200:(ow-iw)/2:(oh-ih)/2:black",
      "-q:v", "3", poster,
    ]);
    const result = await readFile(poster);
    if (!result.length) throw new Error("VIDEO_POSTER_EMPTY");
    return result;
  });
}

export async function createWatermarkedShareVideo(source: Buffer, watermarkText: string): Promise<Buffer> {
  return withVideoWorkspace(source, async ({ input, output, watermark }) => {
    await writeFile(watermark, watermarkText.slice(0, 160), { encoding: "utf8", mode: 0o600 });
    const x = "if(lt(mod(t\\,8)\\,2)\\,24\\,if(lt(mod(t\\,8)\\,4)\\,w-tw-24\\,if(lt(mod(t\\,8)\\,6)\\,w-tw-24\\,24)))";
    const y = "if(lt(mod(t\\,8)\\,2)\\,24\\,if(lt(mod(t\\,8)\\,4)\\,24\\,if(lt(mod(t\\,8)\\,6)\\,h-th-24\\,h-th-24)))";
    const filter = [
      "scale=1080:1920:force_original_aspect_ratio=decrease",
      "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
      `drawtext=fontfile=${FONT_FILE}:textfile=${watermark}:reload=0:fontcolor=white:fontsize=38:line_spacing=10:borderw=3:bordercolor=black@0.78:box=1:boxcolor=black@0.24:boxborderw=14:x='${x}':y='${y}'`,
    ].join(",");
    await runFfmpeg([
      "-i", input, "-vf", filter, "-map", "0:v:0", "-map", "0:a?",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-threads", "2", output,
    ]);
    const result = await readFile(output);
    if (!result.length || result.length > MAX_OUTPUT_BYTES) throw new Error("VIDEO_OUTPUT_SIZE_INVALID");
    return result;
  });
}
