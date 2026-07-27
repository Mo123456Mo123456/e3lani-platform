import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertNoClientControlledUrl, planRenditions } from './processor';
import { probeVideo, validateVideoDuration } from './video-processor';

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

describe('media worker', () => {
  afterEach(() => {
    spawnMock.mockReset();
  });

  it('plans video renditions', () => {
    expect(planRenditions('video')).toEqual(['poster', '720p']);
  });

  it('rejects untrusted media hosts', () => {
    expect(() => assertNoClientControlledUrl('https://evil.example/a.mp4', ['cdn.e3lani.sa'])).toThrow(
      /not allowed/,
    );
  });

  it('probes video metadata from ffprobe JSON', async () => {
    spawnMock.mockReturnValue(
      mockProcess(
        JSON.stringify({
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 1280,
              height: 720,
              duration: '9.1',
            },
          ],
        }),
      ) as never,
    );

    await expect(probeVideo('/tmp/input.mov')).resolves.toEqual({
      durationSec: 9.1,
      width: 1280,
      height: 720,
      codec: 'h264',
    });
  });

  it('rejects videos over the duration limit', () => {
    expect(() => validateVideoDuration(61)).toThrow(/VIDEO_DURATION_EXCEEDED/);
  });
});
