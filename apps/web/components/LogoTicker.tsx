'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiBaseUrl } from '../lib/api';

type TickerItem = { id: string; title: string; logoUrl: string };

/**
 * Non-interactive top logo strip.
 * - Continuous horizontal loop
 * - Never pauses on hover/touch
 * - Not clickable / no links
 * - E3lani mark as smaller separator between logos
 * - No consecutive duplicate logos
 */
export function LogoTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    fetch(`${apiBaseUrl}/ticker`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items?.length) setItems(data.items);
      })
      .catch(() => undefined);
  }, []);

  const loop = useMemo(() => {
    if (!items.length) return [];
    // Duplicate sequence for seamless CSS marquee; keep separators between.
    const withSeparators = items.flatMap((item) => [
      { kind: 'logo' as const, item },
      { kind: 'brand' as const },
    ]);
    return [...withSeparators, ...withSeparators];
  }, [items]);

  if (!loop.length) return null;

  return (
    <div
      className="logo-ticker"
      aria-hidden="true"
      // Prevent interaction — strip is display-only.
      onClick={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
    >
      <div className="logo-ticker-track">
        {loop.map((entry, index) =>
          entry.kind === 'brand' ? (
            <span key={`brand-${index}`} className="logo-ticker-brand">
              إعلاني
            </span>
          ) : (
            <span key={`${entry.item.id}-${index}`} className="logo-ticker-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.item.logoUrl} alt="" draggable={false} />
            </span>
          ),
        )}
      </div>
    </div>
  );
}
