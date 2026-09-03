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
 *
 * The left-column carousel itself was extracted into
 * `BridgeMediaCarouselPane` (2026-09-03, CFS media/interaction reuse pass)
 * so the Financial Sovereignty bridge sections can reuse the SAME carousel
 * rather than a hand-copied second one — this component's own visible
 * output is unchanged by that extraction.
 */

import { useEffect, useState } from 'react';
import { ConstitutionalFrontierOrientSurface } from '@/components/journey/ConstitutionalFrontierOrientSurface';
import type { CanonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { BridgeMediaCarouselPane, type BridgeMediaCarouselItem } from '@/components/journey/BridgeMediaCarouselPane';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

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

  const carouselItems: BridgeMediaCarouselItem[] = [
    {
      kind: 'video',
      videoUrl: config.videoUrl,
      posterUrl: config.posterUrl,
      fallback: fallbackPlate ? { url: fallbackPlate.url, title: fallbackPlate.title } : undefined,
      srLabel: 'Show orientation media',
    },
    ...carouselPlates.map((plate) => ({ kind: 'plate' as const, url: plate.url, title: plate.title })),
  ];

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
      <BridgeMediaCarouselPane items={carouselItems} emptyLabel="No orientation media configured." />

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
