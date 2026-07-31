'use client';

import { TickerBar, type TickerLogoItem } from '@e3lani/ui';

export function TickerStrip({ logos }: { logos: TickerLogoItem[] }) {
  if (!logos.length) return null;
  return <TickerBar logos={logos} locale="ar" />;
}
