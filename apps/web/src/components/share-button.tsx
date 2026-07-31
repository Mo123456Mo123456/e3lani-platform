'use client';

import { Share2 } from 'lucide-react';

export function ShareButton({ url, title }: { url: string; title: string }) {
  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label="مشاركة"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-ink-muted"
    >
      <Share2 size={18} />
    </button>
  );
}
