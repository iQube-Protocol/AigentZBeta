'use client';

/**
 * ConstitutionalInternetBridgeOrientIntro — the CI Bridge's ORIENT surface,
 * evolved (2026-08-11) to add a media/context layer ahead of the existing
 * questionnaire, per the operator's framing: "the problem is that it
 * currently arrives too cold and feels form-like."
 *
 * Composes two things, unchanged:
 *   - a NEW, small self-fetching media header (same config pattern as
 *     ConstitutionalInternetBridgeMediaStage / KnytsBridgeMediaStage — GET
 *     /api/journey/knyts-bridge/editorial-config?section=ci-orient) framing
 *     the core proposition: personhood precedes identity;
 *   - the EXISTING, UNTOUCHED ConstitutionalFrontierOrientSurface, nested in
 *     a bordered "reflection capsule" card so the questionnaire reads as a
 *     continuation of the header above it rather than a bare form dropped
 *     onto an empty page. No logic inside that component changes.
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

      {/* Reflection capsule — the questionnaire emerges from the personhood
          framing above rather than sitting alone on an empty page. A subtle
          top gradient carries the eye from the header into the card; the
          card itself is the canonical slate surface (CLAUDE.md house
          style), never a white-hairline residual. */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 -top-4 h-4 bg-gradient-to-b from-transparent to-slate-900/40" />
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <ConstitutionalFrontierOrientSurface />
        </div>
      </div>
    </div>
  );
}

export default ConstitutionalInternetBridgeOrientIntro;
