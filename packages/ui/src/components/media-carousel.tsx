'use client';

import * as React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib';

export interface CarouselMedia {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  url: string | null;
  thumbnailUrl: string | null;
  blurhash?: string | null;
  aspectRatio?: number | null;
}

export interface MediaCarouselProps {
  media: CarouselMedia[];
  /** هل هذا العنصر ظاهر حاليًا في الموجز (يشغّل الفيديو تلقائيًا) */
  active?: boolean;
  className?: string;
  onMediaChange?: (index: number) => void;
}

/**
 * عرض وسائط الإعلان:
 *  • تشغيل تلقائي بدون صوت عند الظهور، وإيقاف فوري عند الانتقال.
 *  • زر تشغيل/إيقاف الصوت.
 *  • تحميل تدريجي مع Placeholder.
 *  • السحب الأفقي للصور المتعددة مع مؤشر نقاط.
 *  • إخفاء عناصر التحكم بعد ثوانٍ من عدم التفاعل.
 *  • يملأ المساحة دون تشويه (object-cover) ويدعم العمودي والمربع والأفقي.
 */
export function MediaCarousel({ media, active = false, className, onMediaChange }: MediaCarouselProps) {
  const [index, setIndex] = React.useState(0);
  const [muted, setMuted] = React.useState(true);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const videoRefs = React.useRef<Record<string, HTMLVideoElement | null>>({});
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = media[index];
  const hasVideo = media.some((item) => item.type === 'VIDEO');

  // تشغيل/إيقاف الفيديو حسب الظهور والعنصر الحالي
  React.useEffect(() => {
    for (const [id, element] of Object.entries(videoRefs.current)) {
      if (!element) continue;
      const shouldPlay = active && current?.id === id;
      if (shouldPlay) {
        element.muted = muted;
        void element.play().catch(() => undefined);
      } else {
        element.pause();
        element.currentTime = 0;
      }
    }
  }, [active, current?.id, muted]);

  const revealControls = React.useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  React.useEffect(() => {
    revealControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [revealControls, index, active]);

  const handleScroll = React.useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    const normalized = Math.abs(next);
    if (normalized !== index && media[normalized]) {
      setIndex(normalized);
      onMediaChange?.(normalized);
    }
  }, [index, media, onMediaChange]);

  if (!media.length) {
    return <div className={cn('bg-surface', className)} aria-hidden />;
  }

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden bg-black', className)}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        dir="ltr"
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        {media.map((item) => (
          <div key={item.id} className="relative h-full w-full shrink-0 snap-center">
            {item.blurhash ? (
              // عنصر نائب أثناء التحميل التدريجي
              <img
                src={item.blurhash}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
              />
            ) : null}

            {item.type === 'VIDEO' ? (
              <video
                ref={(element) => {
                  videoRefs.current[item.id] = element;
                }}
                src={item.url ?? undefined}
                poster={item.thumbnailUrl ?? undefined}
                muted={muted}
                loop
                playsInline
                preload="metadata"
                className="relative h-full w-full object-cover"
              />
            ) : (
              <img
                src={item.url ?? item.thumbnailUrl ?? ''}
                alt=""
                loading="lazy"
                decoding="async"
                className="relative h-full w-full object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {media.length > 1 ? (
        <div
          className={cn(
            'pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 transition-opacity',
            controlsVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {media.map((item, dotIndex) => (
            <span
              key={item.id}
              className={cn(
                'h-1.5 rounded-pill transition-all',
                dotIndex === index ? 'w-5 bg-primary' : 'w-1.5 bg-white/60',
              )}
            />
          ))}
        </div>
      ) : null}

      {hasVideo ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setMuted((value) => !value);
            revealControls();
          }}
          aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className={cn(
            'absolute end-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-opacity',
            controlsVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      ) : null}
    </div>
  );
}
