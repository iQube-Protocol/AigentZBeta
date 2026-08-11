'use client';

/**
 * ConstitutionalInternetBridgeOrientIntro — the CI Bridge's ORIENT surface.
 *
 * Editorial polish pass (2026-08-11): the hero used to be able to grow to
 * "nearly an entire viewport" before the actual questions appeared —
 * exactly backwards for a stage the operator calls "an interactive
 * reflection ritual, not an image-viewing page." The hero is now a
 * cinematic HEADER STRIP, capped at a real height (not left to an
 * unconstrained `w-full` video/poster box), so the question capsule below
 * is reliably visible in the same viewport.
 *
 * Default visual is the real canonical CIP-007B plate ("Constitutional
 * Bearing Instrument — Navigate the Atlas", services/artifact/
 * canonicalPlateImages.ts) — never decorative/generic imagery. An admin
 * MAY still configure a real video (same config pattern as
 * ConstitutionalInternetBridgeMediaStage — GET /api/journey/knyts-bridge/
 * editorial-config?section=ci-orient) which takes over the same
 * capped-height frame when present.
 *
 * Composes with ConstitutionalFrontierOrientSurface, which since 2026-08-11
 * renders itself as a BridgeContentCapsule (its own bordered shell) — so
 * this wrapper does not nest it in a second border; one capsule chrome.
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

  const paragraphs = (config.shortCopy ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].shortCopy ?? '')
    .split('\n\n')
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-5">
        <div className="h-[26vh] max-h-56 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#faf7f0] sm:w-64">
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
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-white">
            {config.headline ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].headline}
          </h2>
          <div className="mx-auto mt-2 max-w-[60ch] sm:mx-0">
            {paragraphs.map((p, i) => (
              <p key={i} className="mt-1.5 text-[15px] leading-[1.5] text-slate-300">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>

      <ConstitutionalFrontierOrientSurface />
    </div>
  );
}

export default ConstitutionalInternetBridgeOrientIntro;
