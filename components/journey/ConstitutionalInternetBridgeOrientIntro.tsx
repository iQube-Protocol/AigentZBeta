'use client';

/**
 * ConstitutionalInternetBridgeOrientIntro — the CI Bridge's ORIENT surface.
 *
 * Reconstituted 2026-08-11 (final interaction + layout pass) as a true
 * two-column composition — REVERSING the same day's earlier "cinematic
 * header strip" pass, which had shrunk the canonical media down to a
 * ~26vh thumbnail. The operator's own words: "The current page is too
 * compressed in the opposite direction: the media has become a small
 * thumbnail. Reconstitute Orient as a proper two-column experience." Media
 * is once again dominant (left column, ~60% width, fills most of the
 * available viewport height, aspect ratio preserved via object-contain —
 * never cropped/stretched); the right column (~40%) carries the
 * proposition/intro copy and the question capsule
 * (ConstitutionalFrontierOrientSurface), keeping the compressed copy
 * treatment from the prior pass rather than reverting to long centered
 * prose.
 *
 * MEDIA CAROUSEL (2026-08-12, media-carousel-only pass) — the left pane is
 * now a restrained 2-item horizontal carousel, extending (never replacing)
 * the prior single-media pane:
 *   Item 1 (default) — the same admin-configured video (falls back to the
 *     real canonical CIP-007B "Bearing Instrument" plate when no video is
 *     configured) — byte-for-byte the PRIOR single-media rendering.
 *   Item 2 — the real canonical CIP-004 plate ("Government-Grade, Not
 *     Government-Dependent", services/artifact/canonicalPlateImages.ts —
 *     the SAME title-keyed canonical registry Item 1's own CIP-007B
 *     fallback already reads from, so this resolves by canonical metadata,
 *     never a fabricated/generic replacement), mounted in the same
 *     ArtifactMattedFrame parchment treatment Choose/View use for every
 *     other canonical plate, with the same FullscreenableFrame expand
 *     affordance — never routed through the Papers/PDF reader.
 * The right column (questionnaire) is untouched by this pass — no size,
 * position, copy, or completion-logic change.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ConstitutionalFrontierOrientSurface } from '@/components/journey/ConstitutionalFrontierOrientSurface';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { ArtifactMattedFrame } from '@/components/journey/ArtifactMattedFrame';
import { FullscreenableFrame } from '@/components/journey/FullscreenableFrame';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

const SECTION = 'ci-orient';
const BEARING_INSTRUMENT = canonicalPlateImage('CIP-007B');
const GOVERNMENT_GRADE_PLATE = canonicalPlateImage('CIP-004');

// Minimum horizontal drag distance (px) before a touch/pointer gesture
// counts as a swipe rather than a tap/scroll — restrained, not twitchy.
const SWIPE_THRESHOLD_PX = 40;

export function ConstitutionalInternetBridgeOrientIntro() {
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION]);
  // 0 = video (or CIP-007B fallback) — the default. 1 = the CIP-004 plate.
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const showPrev = () => setActiveIndex((i) => (i === 0 ? 1 : 0));
  const showNext = () => setActiveIndex((i) => (i === 1 ? 0 : 1));

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
    fetch(`/api/journey/knyts-bridge/editorial-config?section=${SECTION}`, { cache: 'no-store' })
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
  }, []);

  // One compact continuous paragraph (integration pass, 2026-08-11) — never
  // multiple <p> blocks. Admin-authored copy may still use \n\n to organize
  // the source text, but any such break is a paragraph-authoring artifact,
  // not an intentional line break the visitor should see; join with a space
  // rather than rendering each chunk as its own paragraph.
  const introCopy = (config.shortCopy ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].shortCopy ?? '')
    .split('\n\n')
    .filter(Boolean)
    .join(' ');

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* LEFT — dominant media (~60% width on desktop), fills most of the
          viewport height. Now a restrained 2-item carousel; sizing/aspect-
          preservation behavior is unchanged from the prior single-media
          pane. Controls belong to this pane only — the questionnaire column
          is never touched by carousel state. */}
      <div className="flex flex-col gap-2">
        <div
          className="h-[60vh] max-h-[70vh] min-h-[18rem] w-full"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
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
              ) : (
                BEARING_INSTRUMENT && (
                  <img
                    src={BEARING_INSTRUMENT.url}
                    alt={BEARING_INSTRUMENT.title}
                    className="h-full w-full object-contain"
                  />
                )
              )}
            </div>
          ) : (
            GOVERNMENT_GRADE_PLATE && (
              <FullscreenableFrame className="h-full w-full bg-slate-900/40" title={GOVERNMENT_GRADE_PLATE.title}>
                <ArtifactMattedFrame>
                  <img
                    src={GOVERNMENT_GRADE_PLATE.url}
                    alt={GOVERNMENT_GRADE_PLATE.title}
                    className="h-full w-full object-contain"
                  />
                </ArtifactMattedFrame>
              </FullscreenableFrame>
            )
          )}
        </div>

        {/* Restrained carousel navigation — previous chevron, two position
            dots, next chevron. Belongs to the media pane only. */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={showPrev}
            aria-label="Previous"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-900/60 p-1 text-slate-400 transition hover:border-white/20 hover:text-slate-200"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {[0, 1].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={i === 0 ? 'Show orientation video' : 'Show Government-Grade, Not Government-Dependent plate'}
              aria-current={activeIndex === i}
              className={`h-1.5 w-1.5 rounded-full transition ${
                activeIndex === i ? 'bg-indigo-300' : 'bg-slate-600 hover:bg-slate-500'
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
      </div>

      {/* RIGHT — proposition, intro copy, and the question capsule. */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {config.headline ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].headline}
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

export default ConstitutionalInternetBridgeOrientIntro;
