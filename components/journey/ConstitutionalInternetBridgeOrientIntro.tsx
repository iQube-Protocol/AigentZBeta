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
 * Default visual is the real canonical CIP-007B plate ("Constitutional
 * Bearing Instrument — Navigate the Atlas", services/artifact/
 * canonicalPlateImages.ts) — never decorative/generic imagery. An admin
 * MAY still configure a real video (same config pattern as
 * ConstitutionalInternetBridgeMediaStage — GET /api/journey/knyts-bridge/
 * editorial-config?section=ci-orient) which takes over the same frame when
 * present.
 */

import { useEffect, useState } from 'react';
import { ConstitutionalFrontierOrientSurface } from '@/components/journey/ConstitutionalFrontierOrientSurface';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

const SECTION = 'ci-orient';
const BEARING_INSTRUMENT = canonicalPlateImage('CIP-007B');

export function ConstitutionalInternetBridgeOrientIntro() {
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION]);

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
          viewport height, aspect ratio preserved via object-contain. */}
      <div className="flex h-[60vh] max-h-[70vh] min-h-[18rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
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
