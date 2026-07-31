'use client';

import * as React from 'react';
import { TICKER } from '@e3lani/config';
import { cn } from '../lib';
import { Logo } from './logo';

export interface TickerLogoItem {
  id: string;
  businessName: string;
  logoUrl: string;
}

export interface TickerBarProps {
  logos: TickerLogoItem[];
  locale?: 'ar' | 'en';
  className?: string;
  /** مدة الدورة بالثواني */
  durationSeconds?: number;
}

/**
 * الشريط الإعلاني العلوي — شعارات فقط.
 *
 * قواعد ثابتة مطبّقة هنا:
 *  • حركة أفقية مستمرة وناعمة (Loop) لا تتوقف عند اللمس أو المرور بالمؤشر.
 *  • غير قابل للنقر إطلاقًا: لا عناصر <a> ولا معالجات ضغط، مع pointer-events: none.
 *  • شعار «إعلاني» يظهر كفاصل أصغر بين الشعارات.
 *  • لا يتكرر الشعار نفسه مرتين متتاليتين.
 *  • يدعم RTL و LTR.
 */
export function TickerBar({
  logos,
  locale = 'ar',
  className,
  durationSeconds = TICKER.loopDurationSeconds,
}: TickerBarProps) {
  const sequence = React.useMemo(() => buildSequence(logos), [logos]);
  if (!sequence.length) return null;

  const isRtl = locale === 'ar';

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden border-b border-line bg-white',
        // الشريط عرضي بحت: لا نقر ولا تحديد ولا تركيز
        'select-none pointer-events-none',
        className,
      )}
      role="presentation"
      aria-hidden="true"
      dir="ltr"
    >
      <div
        className={cn('flex w-max items-center gap-8 py-2', isRtl ? 'animate-ticker-rtl' : 'animate-ticker-ltr')}
        style={{ ['--ticker-duration' as string]: `${durationSeconds}s` }}
      >
        {[0, 1].map((copy) => (
          <React.Fragment key={copy}>
            {sequence.map((entry, index) =>
              entry.kind === 'separator' ? (
                <span key={`sep-${copy}-${index}`} className="flex shrink-0 items-center opacity-40">
                  <Logo size={18} withWordmark={false} muted />
                </span>
              ) : (
                <span
                  key={`logo-${copy}-${entry.item.id}-${index}`}
                  className="flex h-9 shrink-0 items-center"
                >
                  <img
                    src={entry.item.logoUrl}
                    alt=""
                    className="h-9 w-auto max-w-[120px] object-contain grayscale-0"
                    loading="lazy"
                    draggable={false}
                  />
                </span>
              ),
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

type SequenceEntry =
  | { kind: 'logo'; item: TickerLogoItem }
  | { kind: 'separator' };

/** يبني تسلسل العرض: شعار ← فاصل «إعلاني» ← شعار، دون تكرار متتالٍ. */
export function buildSequence(logos: TickerLogoItem[]): SequenceEntry[] {
  const ordered = dedupeAdjacent(logos);
  const entries: SequenceEntry[] = [];
  ordered.forEach((item, index) => {
    entries.push({ kind: 'logo', item });
    if ((index + 1) % TICKER.separatorEvery === 0) entries.push({ kind: 'separator' });
  });
  return entries;
}

/** يمنع ظهور الشعار نفسه مرتين متتاليتين. */
export function dedupeAdjacent(logos: TickerLogoItem[]): TickerLogoItem[] {
  const remaining = [...logos];
  const result: TickerLogoItem[] = [];
  while (remaining.length) {
    const previous = result[result.length - 1];
    let index = remaining.findIndex((logo) => !previous || logo.logoUrl !== previous.logoUrl);
    if (index === -1) index = 0;
    result.push(remaining.splice(index, 1)[0]!);
  }
  // يمنع التكرار عند نقطة التفاف الحلقة أيضًا
  if (result.length > 2 && result[0]!.logoUrl === result[result.length - 1]!.logoUrl) {
    const moved = result.pop()!;
    result.splice(Math.max(1, result.length - 1), 0, moved);
  }
  return result;
}
