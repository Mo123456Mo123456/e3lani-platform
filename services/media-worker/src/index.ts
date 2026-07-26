/**
 * Media worker scaffold.
 * Production path: receive upload-complete jobs → validate MIME → FFmpeg transcode
 * (1080/720/480) → poster → strip sensitive metadata → mark asset ready for moderation.
 */
export type MediaJob = {
  assetId: string;
  storageKey: string;
  kind: 'image' | 'video';
};

export type ProcessedRendition = {
  quality: '1080p' | '720p' | '480p' | 'original';
  key: string;
};

export function planRenditions(kind: MediaJob['kind']): ProcessedRendition['quality'][] {
  if (kind === 'image') return ['original'];
  return ['1080p', '720p', '480p'];
}

export function assertNoClientControlledUrl(url: string, allowedHosts: string[]): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid media URL');
  }
  if (!allowedHosts.includes(parsed.host)) {
    throw new Error('Media URL host is not allowed');
  }
}

if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log('E3lani media-worker idle — connect Redis/BullMQ to process jobs');
}
