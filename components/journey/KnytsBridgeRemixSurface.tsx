'use client';

/**
 * KnytsBridgeRemixSurface — the REMIX stage's surface (surface
 * reconciliation, 2026-08-09): "REMIX → metaMe/aigentMe → myCanvas... Deep-
 * link directly into the relevant myCanvas creation state, but let it
 * remain inside the metaMe/aigentMe environment."
 *
 * Embeds the SAME myCanvas tab every other Remix path uses
 * (metame-codex/mycanvas — RemixDialog + MyCanvasTab, unchanged), carrying:
 *   - `remix=<payload>` when resuming an interrupted Remix intent (the
 *     OUTER page's own URL, not this component's — RemixCrossingButton
 *     targets `/bridge/knyts?remix=...` when launched from this journey,
 *     see KnytCommunityContentTab.tsx);
 *   - `campaignTag=knyts-bridge-crossing`, so MyCanvasTab's starter-template
 *     affordance offers "Crossing the Threshold" instead of the generic
 *     Qriptopian seed (see MyCanvasTab.tsx's own CAMPAIGN_TEMPLATES map).
 *
 * A plain `kind: 'embed'` registry descriptor can't carry a per-visit
 * dynamic payload like `remix=`, so this stays a `component` surface that
 * builds its own iframe src — the ONE deliberate exception to "embed via
 * the registry" in this journey, and only because of that dynamism.
 */

import { useEffect, useState } from 'react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';

interface Props {
  personaId?: string;
}

export function KnytsBridgeRemixSurface({ personaId }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const base = buildCodexUrl('metame-codex', {
      tab: 'mycanvas',
      personaId,
      shell: 'embed',
      suppressCopilot: true,
    });
    try {
      const url = new URL(base, window.location.origin);
      url.searchParams.set('campaignTag', KNYTS_BRIDGE_CAMPAIGN_ID);
      const pendingRemix = new URL(window.location.href).searchParams.get('remix');
      if (pendingRemix) url.searchParams.set('remix', pendingRemix);
      setSrc(url.pathname + url.search);
    } catch {
      setSrc(base);
    }
  }, [personaId]);

  if (!src) return null;

  return (
    <iframe
      src={src}
      title="Crossing the Threshold — myCanvas"
      className="h-[36rem] w-full rounded-md border border-slate-800 bg-slate-950"
    />
  );
}

export default KnytsBridgeRemixSurface;
