'use client';

/**
 * BridgeMediaCarouselPane — the LEFT-column media carousel extracted from
 * `BridgeOrientSurface.tsx` (CFS media/interaction reuse pass, 2026-09-03).
 * `BridgeOrientSurface` composed this inline (item 0 = admin video/fallback
 * plate, items 1..N = extra canonical plates, chevrons + dots when there is
 * more than one item, swipe). Pulled out unchanged so it can be reused
 * by any "media beside a focused interaction" composition (e.g. the
 * Financial Sovereignty bridge sections) without a second, hand-copied
 * carousel implementation — `BridgeOrientSurface` now imports this file
 * instead of owning the markup itself, with byte-identical visible output.
 *
 * Swipe (2026-09-06 fix): originally touch-events-only (`onTouchStart`/
 * `onTouchEnd`), which never fires from a mouse or trackpad drag on a
 * desktop browser — the reported "swiping not working" was tested on a
 * MacBook trackpad, not a touchscreen. Pointer Events unify mouse, touch
 * and pen under one API, so the same drag-distance logic now runs off
 * `onPointerDown`/`onPointerUp` and works on every input type.
 */

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ArtifactMattedFrame } from '@/components/journey/ArtifactMattedFrame';
import { FullscreenableFrame } from '@/components/journey/FullscreenableFrame';

// Minimum horizontal drag distance (px) before a pointer gesture counts as
// a swipe rather than a tap/click — restrained, not twitchy.
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
  /**
   * Nav placement (2026-09-06). Default `'below'` is the ORIGINAL, unchanged
   * behavior (prev/dots/next in their own row under the media, ignored by
   * nothing — byte-identical for BridgeOrientSurface and every other
   * existing caller). `'overlay'` floats the SAME prev/dots/next row
   * directly on the media box's own bottom edge instead (no background
   * pill), hidden until rollover/keyboard-focus, so a hero-sized media box
   * (no room reserved below it) still surfaces the carousel position
   * without stealing height or visually competing with the media itself.
   */
  dotsPosition?: 'below' | 'overlay';
  /** Active-dot fill (2026-09-06) — default `'bg-amber-400'` preserves the
   *  ORIGINAL color for BridgeOrientSurface and every other existing
   *  caller. A bridge-accented caller (e.g. the CI Bridge's indigo/lilac
   *  accent vs. KNYTS's amber) passes its own accent class here so the
   *  active dot matches the bridge it's rendered in, never a hardcoded
   *  color from a different bridge's palette. */
  activeDotClassName?: string;
}

export function BridgeMediaCarouselPane({
  items,
  heightClassName = 'h-[60vh] max-h-[70vh] min-h-[18rem]',
  emptyLabel = 'No media configured.',
  dotsPosition = 'below',
  activeDotClassName = 'bg-amber-400',
}: BridgeMediaCarouselPaneProps) {
  const itemCount = items.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);

  const showPrev = () => setActiveIndex((i) => (i === 0 ? itemCount - 1 : i - 1));
  const showNext = () => setActiveIndex((i) => (i === itemCount - 1 ? 0 : i + 1));

  const onPointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerStartX.current === null) return;
    const delta = e.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) showNext();
    else showPrev();
  };
  const onPointerCancel = () => {
    pointerStartX.current = null;
  };

  const item = items[activeIndex];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (itemCount <= 1) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); showNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); showPrev(); }
  };

  const navButtons = (
    <>
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
            activeIndex === i ? activeDotClassName : 'bg-slate-600 hover:bg-slate-500'
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
    </>
  );

  return (
    <div className={dotsPosition === 'overlay' ? 'group relative h-full w-full' : 'flex flex-col gap-2'}>
      <div
        onPointerDown={itemCount > 1 ? onPointerDown : undefined}
        onPointerUp={itemCount > 1 ? onPointerUp : undefined}
        onPointerCancel={itemCount > 1 ? onPointerCancel : undefined}
        onKeyDown={itemCount > 1 ? onKeyDown : undefined}
        tabIndex={itemCount > 1 ? 0 : undefined}
        role={itemCount > 1 ? 'group' : undefined}
        aria-roledescription={itemCount > 1 ? 'carousel' : undefined}
        aria-label={itemCount > 1 ? 'Lesson media' : undefined}
        className={`w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
          dotsPosition === 'overlay' ? 'h-full' : heightClassName
        }`}
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
          next chevron. Only rendered when there is more than one item.
          'overlay' floats the SAME row directly on the media's own bottom
          edge (no background pill — just the dots/chevrons themselves),
          hidden until the media is rolled over or keyboard-focused, so it
          never competes with the media itself when idle. */}
      {itemCount > 1 &&
        (dotsPosition === 'overlay' ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="pointer-events-auto flex items-center gap-3">{navButtons}</div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">{navButtons}</div>
        ))}
    </div>
  );
}

export default BridgeMediaCarouselPane;
