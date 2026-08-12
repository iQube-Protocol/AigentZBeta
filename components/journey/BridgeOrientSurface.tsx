'use client';

/**
 * BridgeOrientSurface — bridge-neutral ORIENT layout, extracted from CI's
 * `ConstitutionalInternetBridgeOrientIntro` (2026-08-12, KNYTS↔CI parity
 * pass). Two-column composition: left dominant media (single item or a
 * restrained horizontal carousel when extra canonical plates are
 * configured), right constitutional proposition + the shared
 * `ConstitutionalFrontierOrientSurface` questionnaire (Help/Preserve/
 * Authority) — ONE implementation, composed by every bridge, never forked.
 *
 * Item 0 (default) is always the admin-configured video for `section`
 * (falls back to `fallbackPlate` when no video is configured, and to a
 * plain "no orientation media configured" notice when neither exists —
 * never a fabricated image). Items 1..N are `carouselPlates`, each mounted
 * in the same `ArtifactMattedFrame` parchment treatment with the same
 * `FullscreenableFrame` expand affordance — never routed through the
 * Papers/PDF reader. Carousel navigation (chevrons + dots) only renders
 * when there is more than one item, so a bridge with no extra plates (no
 * fabricated second asset) gets a clean single-media pane, not empty
 * controls.
 *
 * CI's own `ConstitutionalInternetBridgeOrientIntro` is now a thin wrapper
 * over this component (section='ci-orient', fallbackPlate=CIP-007B,
 * carouselPlates=[CIP-004]) — its visible output is unchanged.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ConstitutionalFrontierOrientSurface } from '@/components/journey/ConstitutionalFrontierOrientSurface';
import type { CanonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { ArtifactMattedFrame } from '@/components/journey/ArtifactMattedFrame';
import { FullscreenableFrame } from '@/components/journey/FullscreenableFrame';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

// Minimum horizontal drag distance (px) before a touch/pointer gesture
// counts as a swipe rather than a tap/scroll — restrained, not twitchy.
const SWIPE_THRESHOLD_PX = 40;

export interface BridgeOrientSurfaceProps {
  /** editorial_config section key (e.g. 'ci-orient' or 'orient'). */
  section: string;
  /** Real canonical plate shown when no admin video is configured for
   *  `section`. Never a fabricated replacement — omit if none exists. */
  fallbackPlate?: CanonicalPlateImage;
  /** Additional canonical plate items beyond item 0. Default []. */
  carouselPlates?: CanonicalPlateImage[];
}

export function BridgeOrientSurface({ section, fallbackPlate, carouselPlates = [] }: BridgeOrientSurfaceProps) {
  const defaults = KNYTS_BRIDGE_SECTION_DEFAULTS[section] ?? KNYTS_BRIDGE_SECTION_DEFAULTS.home;
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(defaults);
  const itemCount = 1 + carouselPlates.length;
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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/journey/knyts-bridge/editorial-config?section=${section}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.ok && json.config) setConfig(json.config);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  // One compact continuous paragraph — never multiple <p> blocks.
  // Admin-authored copy may still use \n\n to organize the source text, but
  // any such break is a paragraph-authoring artifact, not an intentional
  // line break the visitor should see; join with a space rather than
  // rendering each chunk as its own paragraph.
  const introCopy = (config.shortCopy ?? defaults.shortCopy ?? '')
    .split('\n\n')
    .filter(Boolean)
    .join(' ');

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* LEFT — dominant media (~60% width on desktop), fills most of the
          viewport height. A restrained carousel when extra plates are
          configured; a single pane otherwise. Controls belong to this pane
          only — the questionnaire column is never touched by carousel
          state. */}
      <div className="flex flex-col gap-2">
        <div
          className="h-[60vh] max-h-[70vh] min-h-[18rem] w-full"
          onTouchStart={itemCount > 1 ? onTouchStart : undefined}
          onTouchEnd={itemCount > 1 ? onTouchEnd : undefined}
        >
          {activeIndex === 0 ? (
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
              {config.videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  className="h-full w-full object-contain"
                  controls
                  poster={config.posterUrl ?? undefined}
                  src={config.videoUrl}
                />
              ) : fallbackPlate ? (
                <img
                  src={fallbackPlate.url}
                  alt={fallbackPlate.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <p className="px-6 text-center text-sm text-slate-500">No orientation media configured.</p>
              )}
            </div>
          ) : (
            (() => {
              const plate = carouselPlates[activeIndex - 1];
              return plate ? (
                <FullscreenableFrame className="h-full w-full bg-slate-900/40" title={plate.title}>
                  <ArtifactMattedFrame>
                    <img src={plate.url} alt={plate.title} className="h-full w-full object-contain" />
                  </ArtifactMattedFrame>
                </FullscreenableFrame>
              ) : null;
            })()
          )}
        </div>

        {/* Restrained carousel navigation — previous chevron, position
            dots, next chevron. Only rendered when there is more than one
            item — a bridge with no extra plates gets a clean single-media
            pane, never empty/inert controls. */}
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
            {Array.from({ length: itemCount }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={i === 0 ? 'Show orientation media' : `Show ${carouselPlates[i - 1]?.title ?? 'plate'}`}
                aria-current={activeIndex === i}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  // Same selected-dot token as View's own carousel — always
                  // amber, regardless of the host bridge's accent theme.
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

      {/* RIGHT — proposition, intro copy, and the shared question capsule. */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {config.headline ?? defaults.headline}
          </h2>
          {introCopy && (
            <p className="mt-2 text-[13px] leading-[1.5] text-slate-300">{introCopy}</p>
          )}
        </div>
        <ConstitutionalFrontierOrientSurface />
      </div>
    </div>
  );
}

export default BridgeOrientSurface;
