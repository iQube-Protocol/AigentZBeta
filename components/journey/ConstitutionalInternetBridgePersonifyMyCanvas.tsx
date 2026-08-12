'use client';

/**
 * ConstitutionalInternetBridgePersonifyMyCanvas — PERSONIFY surface.
 * Full-width myCanvas editor for telling or remixing your constitutional story.
 *
 * Mirrors KnytsBridgeRemixSurface's pattern for the myCanvas half —
 * the SAME myCanvas tab (metame-codex/mycanvas — RemixDialog + MyCanvasTab,
 * unchanged) embedded with the shared focused-surface contract
 * (utils/codex-nav.ts's `focused`/`focusedNavDepth`):
 *
 *   - `campaignTag=CI_BRIDGE_CAMPAIGN_ID` — selects MyCanvasTab's
 *     "Tell your Constitutional story" starter template
 *     (CAMPAIGN_CANVAS_TEMPLATES) and forces published Articles/Stories to
 *     Qriptopian Pulse (cartridge='qripto') rather than KNYT/Qriptopian choice.
 *   - `focusedNavDepth: 0` when focused (content-only); omitted when expanded
 *     to Full so the destination renders complete canonical chrome.
 *
 * `remix=` resume payload: when View's Crossings tab fires a Remix click,
 * it stashes the intent via services/journey/ciBridgeRemixIntent.ts and
 * switches the spine here — this component forwards it as a `remix=` param
 * on the myCanvas iframe `src`.
 */

import { useEffect, useState } from 'react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';
import { takeCiBridgeRemixIntent } from '@/services/journey/ciBridgeRemixIntent';

interface Props {
  personaId?: string;
}

export function ConstitutionalInternetBridgePersonifyMyCanvas({ personaId }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pendingRemix] = useState(() => takeCiBridgeRemixIntent());

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
        if (pendingRemix) url.searchParams.set('remix', JSON.stringify(pendingRemix));
        return url.pathname + url.search;
      } catch {
        return base;
      }
    };

    // Focused (Lite) by default; Full when expanded.
    setSrc(expanded ? buildSrcForMode(false) : buildSrcForMode(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId, expanded]);

  if (!src) return null;

  return (
    <div className="flex h-full flex-col gap-1.5">
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
        className="w-full flex-1 rounded-md border border-slate-800 bg-slate-950"
      />
    </div>
  );
}

export default ConstitutionalInternetBridgePersonifyMyCanvas;
