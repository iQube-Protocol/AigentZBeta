'use client';

/**
 * BridgeMediaCarouselPane — the LEFT-column media carousel extracted from
 * `BridgeOrientSurface.tsx` (CFS media/interaction reuse pass, 2026-09-03).
 * `BridgeOrientSurface` composed this inline (item 0 = admin video/fallback
 * plate, items 1..N = extra canonical plates, chevrons + dots when there is
 * more than one item, touch-swipe). Pulled out unchanged so it can be reused
 * by any "media beside a focused interaction" composition (e.g. the
 * Financial Sovereignty bridge sections) without a second, hand-copied
 * carousel implementation — `BridgeOrientSurface` now imports this file
 * instead of owning the markup itself, with byte-identical visible output.
 */

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ArtifactMattedFrame } from '@/components/journey/ArtifactMattedFrame';
import { FullscreenableFrame } from '@/components/journey/FullscreenableFrame';

// Minimum horizontal drag distance (px) before a touch/pointer gesture
// counts as a swipe rather than a tap/scroll — restrained, not twitchy.
const SWIPE_THRESHOLD_PX = 40;

export type BridgeMediaCarouselItem =
  | {
      kind: 'video';
      videoUrl?: string | null;
      posterUrl?: string | null;
      /** Shown when videoUrl is absent — never a fabricated image. */
      fallback?: { url: string; title: string };
      /** Optional overlay rendered on top of the video/fallback (e.g. a
       *  "Placeholder video" label) — never baked into the media itself. */
      overlay?: React.ReactNode;
      /** Dot aria-label override. Defaults to "Show video". */
      srLabel?: string;
    }
  | {
      kind: 'plate';
      url: string;
      title: string;
      overlay?: React.ReactNode;
      /** Dot aria-label override. Defaults to `Show ${title}`. */
      srLabel?: string;
    };

export interface BridgeMediaCarouselPaneProps {
  items: BridgeMediaCarouselItem[];
  /** Matches BridgeOrientSurface's own box sizing by default. */
  heightClassName?: string;
  emptyLabel?: string;
}

export function BridgeMediaCarouselPane({
  items,
  heightClassName = 'h-[60vh] max-h-[70vh] min-h-[18rem]',
  emptyLabel = 'No media configured.',
}: BridgeMediaCarouselPaneProps) {
  const itemCount = items.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const showPrev = () => setActiveIndex((i) => (i === 0 ? itemCount - 1 : i - 1));
  const showNext = () => setActiveIndex((i) => (i === itemCount - 1 ? 0 : i + 1));

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) showNext();
    else showPrev();
  };

  const item = items[activeIndex];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`w-full ${heightClassName}`}
        onTouchStart={itemCount > 1 ? onTouchStart : undefined}
        onTouchEnd={itemCount > 1 ? onTouchEnd : undefined}
      >
        {item?.kind === 'video' ? (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
            {item.videoUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video className="h-full w-full object-contain" controls poster={item.posterUrl ?? undefined} src={item.videoUrl} />
            ) : item.fallback ? (
              <img src={item.fallback.url} alt={item.fallback.title} className="h-full w-full object-contain" />
            ) : (
              <p className="px-6 text-center text-sm text-slate-500">{emptyLabel}</p>
            )}
            {item.overlay}
          </div>
        ) : item?.kind === 'plate' ? (
          <FullscreenableFrame className="h-full w-full bg-slate-900/40" title={item.title}>
            <ArtifactMattedFrame>
              <img src={item.url} alt={item.title} className="h-full w-full object-contain" />
            </ArtifactMattedFrame>
            {item.overlay}
          </FullscreenableFrame>
        ) : null}
      </div>

      {/* Restrained carousel navigation — previous chevron, position dots,
          next chevron. Only rendered when there is more than one item. */}
      {itemCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={showPrev}
            aria-label="Previous"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-900/60 p-1 text-slate-400 transition hover:border-white/20 hover:text-slate-200"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {items.map((entry, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={entry.srLabel ?? (entry.kind === 'video' ? 'Show video' : `Show ${entry.title}`)}
              aria-current={activeIndex === i}
              className={`h-1.5 w-1.5 rounded-full transition ${
                activeIndex === i ? 'bg-amber-400' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            />
          ))}
          <button
            type="button"
            onClick={showNext}
            aria-label="Next"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-900/60 p-1 text-slate-400 transition hover:border-white/20 hover:text-slate-200"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default BridgeMediaCarouselPane;
