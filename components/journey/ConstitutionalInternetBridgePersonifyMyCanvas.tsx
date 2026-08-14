'use client';

/**
 * ConstitutionalInternetBridgePersonifyMyCanvas — the PERSONIFY stage's surface.
 *
 * Embeds the canonical myCanvas tab (metame-codex/mycanvas) so the visitor can
 * tell their Constitutional story by remixing an existing piece or starting with
 * Article Zero. Campaign-tagged with constitutional-internet-bridge so the
 * Article Zero instructional template appears by default, marking this as a
 * Constitutional Internet Bridge experience, not a generic myCanvas session.
 *
 * Gated by Passport evidence (citizenPassportUsable) — the page's resolveSurfaceProps
 * only renders this surface when Passport is established.
 *
 * Focused surface-polish pass: applies `focused: true` option (utils/codex-nav.ts)
 * so metaMe's top estate navigation is suppressed, myCanvas's own local controls
 * remain untouched, with an "Explore metaMe ↗" affordance to open full view.
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
      });
      try {
        const url = new URL(base, window.location.origin);
        url.searchParams.set('campaignTag', CI_BRIDGE_CAMPAIGN_ID);
        return url.pathname + url.search;
      } catch {
        return base;
      }
    };

    // Lite: focused=true when not expanded; Full: focused=false when expanded
    setSrc(expanded ? buildSrcForMode(false) : buildSrcForMode(true));
  }, [personaId, expanded]);

  if (!src) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-none border-none cursor-pointer p-0"
        >
          {expanded ? 'Focus view' : 'Explore metaMe ↗'}
        </button>
      </div>
      <iframe
        src={src}
        title="Tell Your Constitutional Story — myCanvas"
        className="h-[calc(100vh-200px)] w-full rounded-md border border-slate-800 bg-slate-950"
      />
    </div>
  );
}

export default ConstitutionalInternetBridgePersonifyMyCanvas;
