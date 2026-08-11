'use client';

/**
 * ConstitutionalInternetBridgePersonifyMyCanvas — PERSONIFY's PRIMARY
 * surface (evolved from ACT, 2026-08-11): "Tell your Constitutional story."
 *
 * Mirrors KnytsBridgeRemixSurface's exact pattern — the SAME myCanvas tab
 * (metame-codex/mycanvas — RemixDialog + MyCanvasTab, unchanged) embedded
 * with the shared focused-surface contract (utils/codex-nav.ts's
 * `focused`/`focusedNavDepth`), never a second editor or a parallel
 * publishing path:
 *
 *   - `campaignTag=CI_BRIDGE_CAMPAIGN_ID` — selects MyCanvasTab's
 *     "Tell your Constitutional story" starter template
 *     (CAMPAIGN_CANVAS_TEMPLATES) and, via its own campaignTag→cartridge
 *     lock map, forces published Articles/Stories to Qriptopian Pulse
 *     (cartridge='qripto') rather than presenting a KNYT/Qriptopian choice —
 *     see MyCanvasTab.tsx and RemixDialog.tsx.
 *   - `focusedNavDepth: 0` when focused (content-only — myCanvas is a
 *     self-contained composer, same depth as KNYTS' own Remix surface);
 *     omitted entirely when expanded to Full, so the destination renders its
 *     complete canonical chrome (the depth-aware Focused/Full contract
 *     fixed for KNYTS this session — see utils/codexChromeDepth.ts).
 *
 * No `remix=` resume payload — unlike KNYTS' Crossing flow, Personify has no
 * "resume an interrupted Remix" requirement in this pass; kept simpler on
 * purpose.
 */

import { useEffect, useState } from 'react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';

interface Props {
  personaId?: string;
}

export function ConstitutionalInternetBridgePersonifyMyCanvas({ personaId }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const buildSrcForMode = (focused: boolean) => {
      const base = buildCodexUrl('metame-codex', {
        tab: 'mycanvas',
        personaId,
        shell: 'embed',
        suppressCopilot: true,
        focused,
        focusedNavDepth: focused ? 0 : undefined,
      });
      try {
        const url = new URL(base, window.location.origin);
        url.searchParams.set('campaignTag', CI_BRIDGE_CAMPAIGN_ID);
        return url.pathname + url.search;
      } catch {
        return base;
      }
    };

    // Focused (Lite) by default; Full when expanded.
    setSrc(expanded ? buildSrcForMode(false) : buildSrcForMode(true));
  }, [personaId, expanded]);

  if (!src) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          Article — your real constitutional perspective. Story — an imagined constitutional life.
        </p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-none border-none cursor-pointer p-0"
        >
          {expanded ? 'Focus view' : 'Explore metaMe ↗'}
        </button>
      </div>
      <iframe
        src={src}
        title="Tell your Constitutional story — myCanvas"
        className="h-[calc(100vh-200px)] w-full rounded-md border border-slate-800 bg-slate-950"
      />
    </div>
  );
}

export default ConstitutionalInternetBridgePersonifyMyCanvas;
