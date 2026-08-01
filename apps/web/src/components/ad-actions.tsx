'use client';

import * as React from 'react';
import {
  Bookmark, Flag, MessageCircle, Phone, Share2, Store, ExternalLink, UserRound,
} from 'lucide-react';
import Link from 'next/link';
import type { AdDto } from '@e3lani/types';
import { Button, cn } from '@e3lani/ui';
import { apiFetch } from '@/lib/api';
import { authedFetch, session } from '@/lib/session';
import { track } from '@/lib/track';

const CONTACT_LABELS: Record<AdDto['contactMethod'], { label: string; icon: typeof Phone }> = {
  WHATSAPP: { label: 'واتساب', icon: MessageCircle },
  PHONE: { label: 'اتصال', icon: Phone },
  STORE_LINK: { label: 'زيارة المتجر', icon: Store },
  PRODUCT_LINK: { label: 'عرض المنتج', icon: Store },
  EXTERNAL_LINK: { label: 'فتح الرابط', icon: ExternalLink },
};

export function contactHref(ad: AdDto): string | null {
  if (!ad.contactValue) return null;
  switch (ad.contactMethod) {
    case 'WHATSAPP':
      return `https://wa.me/${ad.contactValue}?text=${encodeURIComponent(`مرحبًا، بخصوص إعلان «${ad.title}» على إعلاني`)}`;
    case 'PHONE':
      return `tel:+${ad.contactValue}`;
    default:
      return ad.contactValue;
  }
}

const EVENT_BY_METHOD: Record<AdDto['contactMethod'], string> = {
  WHATSAPP: 'CLICK_WHATSAPP',
  PHONE: 'CLICK_CALL',
  STORE_LINK: 'CLICK_STORE',
  PRODUCT_LINK: 'CLICK_STORE',
  EXTERNAL_LINK: 'CLICK_LINK',
};

export function AdActions({ ad, compact = false }: { ad: AdDto; compact?: boolean }) {
  const [saved, setSaved] = React.useState(ad.isSaved);
  const [savesCount, setSavesCount] = React.useState(ad.savesCount);
  const [busy, setBusy] = React.useState(false);
  const contact = CONTACT_LABELS[ad.contactMethod];
  const href = contactHref(ad);
  const ContactIcon = contact.icon;
  // متجر المعلن يظهر كخيار مستقل متى كان مختلفًا عن وسيلة التواصل نفسها
  const storeUrl = ad.owner.business?.storeUrl ?? null;
  const showStore = Boolean(storeUrl && storeUrl !== ad.contactValue);

  const toggleSave = async () => {
    if (!session.accessToken()) {
      window.location.href = `/login?next=${encodeURIComponent(`/ad/${ad.id}`)}`;
      return;
    }
    setBusy(true);
    try {
      const result = await authedFetch<{ saved: boolean; savesCount: number }>(
        `/saved/ads/${ad.id}`,
        { method: saved ? 'DELETE' : 'POST' },
      );
      setSaved(result.saved);
      setSavesCount(result.savesCount);
      track(ad.id, result.saved ? 'SAVE' : 'UNSAVE');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    await apiFetch(`/ads/${ad.id}/share`, { method: 'POST' }).catch(() => undefined);
    track(ad.id, 'SHARE');
    const data = { title: ad.title, url: ad.shareUrl };
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share(data).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(ad.shareUrl).catch(() => undefined);
  };

  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1.5')}>
      {href ? (
        <a
          href={href}
          target={ad.contactMethod === 'PHONE' ? undefined : '_blank'}
          rel="noreferrer noopener"
          onClick={() => track(ad.id, EVENT_BY_METHOD[ad.contactMethod])}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-bold text-ink transition-colors hover:bg-primary-dark"
        >
          <ContactIcon size={18} />
          {contact.label}
        </a>
      ) : null}

      <button
        type="button"
        onClick={toggleSave}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? 'إلغاء الحفظ' : 'حفظ الإعلان'}
        className={cn(
          'grid h-11 w-11 place-items-center rounded-lg border transition-colors',
          saved ? 'border-primary bg-primary/15 text-ink' : 'border-line bg-white text-ink-muted',
        )}
      >
        <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} />
      </button>

      {showStore ? (
        <a
          href={storeUrl as string}
          target="_blank"
          rel="noreferrer noopener"
          onClick={() => track(ad.id, 'CLICK_STORE')}
          aria-label="زيارة متجر المعلن"
          title="زيارة متجر المعلن"
          className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-white text-ink"
        >
          <Store size={19} />
        </a>
      ) : null}

      <Link
        href={`/u/${ad.owner.id}`}
        aria-label="صفحة المعلن"
        title="صفحة المعلن — شاهد بقية إعلاناته ومنشوراته"
        className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-white text-ink-muted"
      >
        <UserRound size={19} />
      </Link>

      <button
        type="button"
        onClick={share}
        aria-label="مشاركة"
        className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-white text-ink-muted"
      >
        <Share2 size={19} />
      </button>

      {!compact ? (
        <a
          href={`/report?adId=${ad.id}`}
          aria-label="إبلاغ"
          className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-white text-ink-muted"
        >
          <Flag size={18} />
        </a>
      ) : null}

      <span className="sr-only">{savesCount} حفظ</span>
    </div>
  );
}
