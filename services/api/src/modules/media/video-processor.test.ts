import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'child_process';
import {
  FfmpegNotAvailableError,
  probeVideo,
  validateVideoDuration,
} from './video-processor';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const spawnMock = vi.mocked(spawn);

function mockProcess(stdout: string, code = 0) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  queueMicrotask(() => {
    if (stdout) child.stdout.emit('data', stdout);
    child.emit('close', code);
  });
  return child;
}

function mockSpawnError(code: string) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  queueMicrotask(() => child.emit('error', Object.assign(new Error('missing'), { code })));
  return child;
}

describe('video processor', () => {
  afterEach(() => {
    spawnMock.mockReset();
  });

  it('parses ffprobe JSON output', async () => {
    spawnMock.mockReturnValue(
      mockProcess(
        JSON.stringify({
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 1920,
              height: 1080,
            },
          ],
          format: { duration: '12.3456' },
        }),
      ) as never,
    );

    await expect(probeVideo('/tmp/video.mp4')).resolves.toEqual({
      durationSec: 12.35,
      width: 1920,
      height: 1080,
      codec: 'h264',
    });
  });

  it('validates maximum video duration', () => {
    expect(() => validateVideoDuration(60)).not.toThrow();
    expect(() => validateVideoDuration(60.01)).toThrow(/VIDEO_DURATION_EXCEEDED/);
  });

  it('throws FFMPEG_NOT_AVAILABLE when ffprobe is missing', async () => {
    spawnMock.mockReturnValue(mockSpawnError('ENOENT') as never);

    await expect(probeVideo('/tmp/video.mp4')).rejects.toBeInstanceOf(FfmpegNotAvailableError);
  });
});
