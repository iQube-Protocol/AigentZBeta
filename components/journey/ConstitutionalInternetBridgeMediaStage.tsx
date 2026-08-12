'use client';

/**
 * ConstitutionalInternetBridgeMediaStage — the CI Bridge's HOME surface,
 * evolved (2026-08-11) to gain the same admin-configurable video/poster/copy
 * capability KNYTS Bridge's HOME already has.
 *
 * Composes two EXISTING things rather than forking either:
 *   - the self-fetching config pattern KnytsBridgeMediaStage established
 *     (GET /api/journey/knyts-bridge/editorial-config?section=ci-home,
 *     falling back to defaults on load/failure);
 *   - the generic BridgeMediaStage render CI's HOME already used, unchanged.
 *
 * Deliberately NOT a copy of KnytsBridgeMediaStage's own render: that
 * component drives its CTA via a `ctaStageId` string it dispatches
 * internally, whereas CI's HOME callbacks (`onPrimaryCta`/`onSecondaryCta`)
 * already come from the page's `resolveSurfaceProps` — reusing
 * BridgeMediaStage directly here preserves that wiring exactly.
 *
 * `eyebrow` and `secondaryCtaLabel` stay fixed (not admin-editable) — the
 * shared `KnytsBridgeEditorialSection` shape has no field for them, and
 * widening that shared shape is out of scope for this narrow reuse pass.
 * Only headline, short copy, video, poster and the primary CTA label are
 * admin-configurable, via the SAME table/route/admin panel KNYTS uses.
 *
 * Passes `layout="cinematic"` (added 2026-08-11, editorial polish pass) —
 * CI's own opt-in variant on the shared shell; KNYTS keeps the default
 * 'standard' layout, visually unchanged.
 */

import { useEffect, useState } from 'react';
import { BridgeMediaStage } from '@/components/journey/BridgeMediaStage';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

const SECTION = 'ci-home';

interface Props {
  onPrimaryCta?: () => void;
  onSecondaryCta?: () => void;
}

export function ConstitutionalInternetBridgeMediaStage({ onPrimaryCta, onSecondaryCta }: Props) {
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/journey/knyts-bridge/editorial-config?section=${SECTION}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.ok && json.config) setConfig(json.config);
      })
      .catch(() => {
        /* keep defaults — HOME must never render blank while signed-out and browsable */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const paragraphs = (config.shortCopy ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].shortCopy ?? '')
    .split('\n\n')
    .filter(Boolean);

  return (
    <BridgeMediaStage
      eyebrow="The Constitutional Internet Bridge"
      headline={config.headline ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].headline ?? ''}
      paragraphs={paragraphs}
      primaryCtaLabel={config.campaignCta ?? 'Enter'}
      onPrimaryCta={onPrimaryCta ?? (() => {})}
      secondaryCtaLabel="Explore the book"
      onSecondaryCta={onSecondaryCta}
      accent="indigo"
      videoUrl={config.videoUrl ?? undefined}
      posterUrl={config.posterUrl ?? undefined}
      layout="cinematic"
    />
  );
}

export default ConstitutionalInternetBridgeMediaStage;
