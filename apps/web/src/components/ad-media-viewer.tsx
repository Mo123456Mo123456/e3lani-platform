'use client';

import * as React from 'react';
import type { AdDto } from '@e3lani/types';
import { MediaCarousel } from '@e3lani/ui';
import { track } from '@/lib/track';

export function AdMediaViewer({ ad }: { ad: AdDto }) {
  React.useEffect(() => {
    track(ad.id, 'IMPRESSION');
    if (ad.media.some((item) => item.type === 'VIDEO')) track(ad.id, 'VIEW_START');
  }, [ad.id, ad.media]);

  const ratio = ad.media[0]?.aspectRatio ?? 4 / 5;
  const paddingTop = `${Math.min(160, Math.max(56, 100 / ratio))}%`;

  return (
    <div className="relative w-full bg-black" style={{ paddingTop }}>
      <div className="absolute inset-0">
        <MediaCarousel
          media={ad.media.map((item) => ({
            id: item.id,
            type: item.type,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            blurhash: item.blurhash,
            aspectRatio: item.aspectRatio,
          }))}
          active
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
