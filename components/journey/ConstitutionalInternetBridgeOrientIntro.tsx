'use client';

/**
 * ConstitutionalInternetBridgeOrientIntro — the CI Bridge's ORIENT surface,
 * evolved (2026-08-11) to add a media/context layer ahead of the existing
 * questionnaire, per the operator's framing: "the problem is that it
 * currently arrives too cold and feels form-like."
 *
 * Composes two things:
 *   - a small self-fetching media header (same config pattern as
 *     ConstitutionalInternetBridgeMediaStage / KnytsBridgeMediaStage — GET
 *     /api/journey/knyts-bridge/editorial-config?section=ci-orient) framing
 *     the core proposition: personhood precedes identity;
 *   - ConstitutionalFrontierOrientSurface, which since 2026-08-11 renders
 *     itself as a BridgeContentCapsule (its own bordered shell) — so this
 *     wrapper no longer nests it in a second "reflection capsule" border;
 *     one capsule chrome, not two.
 *
 * Unlike the HOME wrapper, this header has no CTA button — the "next step"
 * is reading directly into the questions below, not a stage jump.
 */

import { useEffect, useState } from 'react';
import { ConstitutionalFrontierOrientSurface } from '@/components/journey/ConstitutionalFrontierOrientSurface';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

const SECTION = 'ci-orient';

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
      <div className="text-center">
        {config.videoUrl && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video className="w-full" controls poster={config.posterUrl ?? undefined} src={config.videoUrl} />
          </div>
        )}
        <h2 className="text-xl font-bold text-white">
          {config.headline ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].headline}
        </h2>
        {paragraphs.map((p, i) => (
          <p key={i} className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-300">
            {p}
          </p>
        ))}
      </div>

      <ConstitutionalFrontierOrientSurface />
    </div>
  );
}

export default ConstitutionalInternetBridgeOrientIntro;
