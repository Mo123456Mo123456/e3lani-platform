export function publicObjectUrl(storageKey: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? 'http://127.0.0.1:9000/e3lani').replace(/\/$/, '');
  return `${base}/${storageKey.replace(/^\//, '')}`;
}

export function decorateAsset<T extends {
  storageKey: string;
  posterKey?: string | null;
  status: string;
  kind: string;
}>(asset: T) {
  const posterUrl = asset.posterKey ? publicObjectUrl(asset.posterKey) : null;
  const sourceUrl = publicObjectUrl(asset.storageKey);
  const playbackUrl =
    asset.status === 'READY'
      ? asset.kind === 'VIDEO'
        ? asset.posterKey
          ? publicObjectUrl(asset.storageKey.replace(/^uploads\//, 'processed/').replace(/\.[^.]+$/, '') + '/720p.mp4')
          : sourceUrl
        : sourceUrl
      : null;

  return {
    ...asset,
    urls: {
      source: sourceUrl,
      poster: posterUrl,
      playback: playbackUrl ?? posterUrl ?? sourceUrl,
    },
  };
}

export function decorateAdMedia<T extends { asset: Parameters<typeof decorateAsset>[0] }>(
  media: T[],
) {
  return media.map((item) => ({
    ...item,
    asset: decorateAsset(item.asset),
  }));
}
