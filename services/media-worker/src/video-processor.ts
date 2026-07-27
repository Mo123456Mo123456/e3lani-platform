import { spawn } from 'child_process';

export type VideoProbe = {
  durationSec: number;
  width: number;
  height: number;
  codec: string;
};

export class FfmpegNotAvailableError extends Error {
  readonly code = 'FFMPEG_NOT_AVAILABLE';

  constructor(binary: string) {
    super(`FFMPEG_NOT_AVAILABLE:${binary}`);
    this.name = 'FfmpegNotAvailableError';
  }
}

function ffmpegPath() {
  return process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
}

function ffprobePath() {
  return process.env.FFPROBE_PATH?.trim() || 'ffprobe';
}

function runBinary(binary: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(new FfmpegNotAvailableError(binary));
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${binary} failed (${code}): ${stderr.slice(-500)}`));
    });
  });
}

export async function probeVideo(filePath: string): Promise<VideoProbe> {
  const { stdout } = await runBinary(ffprobePath(), [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      duration?: string;
    }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.find((item) => item.codec_type === 'video');
  const durationSec = Number.parseFloat(stream?.duration ?? parsed.format?.duration ?? '');
  if (!stream || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error('VIDEO_PROBE_INVALID');
  }
  if (!stream.width || !stream.height) {
    throw new Error('VIDEO_DIMENSIONS_UNKNOWN');
  }
  return {
    durationSec: Math.round(durationSec * 100) / 100,
    width: stream.width,
    height: stream.height,
    codec: stream.codec_name ?? 'unknown',
  };
}

export function validateVideoDuration(durationSec: number, maxSeconds = 60): void {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error('VIDEO_DURATION_UNKNOWN');
  }
  if (durationSec > maxSeconds) {
    throw new Error(`VIDEO_DURATION_EXCEEDED:${maxSeconds}`);
  }
}

export async function extractPoster(filePath: string, outJpg: string, atSeconds = 1): Promise<void> {
  await runBinary(ffmpegPath(), [
    '-y',
    '-ss',
    String(atSeconds),
    '-i',
    filePath,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    outJpg,
  ]);
}

export async function transcodeTo720p(filePath: string, outMp4: string): Promise<void> {
  await runBinary(ffmpegPath(), [
    '-y',
    '-i',
    filePath,
    '-vf',
    'scale=-2:720',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outMp4,
  ]);
}
