'use client';

/**
 * ConstitutionalInternetBridgePersonifyMyCanvas — PERSONIFY's ONLY surface
 * (evolved from ACT, 2026-08-11; consolidated 2026-08-11, targeted
 * correction pass).
 *
 * Consolidation history: this used to be paired with a SECOND registered
 * stage surface, `ConstitutionalAgentFieldEntrySurface`, which embedded a
 * second `metame-codex/aigent-me` iframe. That iframe's own internal
 * `AigentMeWelcomeSplitTab` shell brings along an unrelated Horizen "Focus
 * Check-in" ceremony (`MoneyPennyFocusLayout`) whenever the persona hasn't
 * answered its own disposition question — so the page ended up showing
 * FOUR stacked representations of "the agent relationship" (myCanvas, the
 * embedded metaMe pane, the embedded aigentMe/Focus-Check-in pane, and CI's
 * own "Shape your story" capsule) instead of one. The fix is a surface-
 * count reduction, not a copilot-plumbing change:
 * `ConstitutionalAgentFieldEntrySurface` is removed from the journey/
 * registry entirely, and its one still-needed piece — the "Shape your
 * story" role/authority question — now renders directly as a React
 * component (no iframe-in-iframe) in a second pane alongside myCanvas,
 * right here, in this one surface.
 *
 * Mirrors KnytsBridgeRemixSurface's exact pattern for the myCanvas half —
 * the SAME myCanvas tab (metame-codex/mycanvas — RemixDialog + MyCanvasTab,
 * unchanged) embedded with the shared focused-surface contract
 * (utils/codex-nav.ts's `focused`/`focusedNavDepth`), never a second editor
 * or a parallel publishing path:
 *
 *   - `campaignTag=CI_BRIDGE_CAMPAIGN_ID` — selects MyCanvasTab's
 *     "Tell your Constitutional story" starter template
 *     (CAMPAIGN_CANVAS_TEMPLATES) and, via its own campaignTag→cartridge
 *     lock map, forces published Articles/Stories to Qriptopian Pulse
 *     (cartridge='qripto') rather than presenting a KNYT/Qriptopian choice —
 *     see MyCanvasTab.tsx and RemixDialog.tsx. The SAME campaignTag also
 *     gates MyCanvasTab's own "Connect Claude" rail chip — that capability
 *     lives in MyCanvasTab's rail now, not as a separate surface here.
 *   - `focusedNavDepth: 0` when focused (content-only — myCanvas is a
 *     self-contained composer, same depth as KNYTS' own Remix surface);
 *     omitted entirely when expanded to Full, so the destination renders its
 *     complete canonical chrome (the depth-aware Focused/Full contract
 *     fixed for KNYTS this session — see utils/codexChromeDepth.ts).
 *
 * `remix=` resume payload: when View's Crossings tab fires a Remix click,
 * it stashes the intent via services/journey/ciBridgeRemixIntent.ts and
 * switches the spine here instead of navigating anywhere — this component
 * takes it once on mount and forwards it as a `remix=` param on the
 * myCanvas iframe `src`, the SAME param MyCanvasTab's own remix-seeding
 * effect already reads for every other Remix entry point (mirrors
 * KnytsBridgeRemixSurface's identical `pendingRemix` handling for
 * `/bridge/knyts?remix=`).
 *
 * Final composition (targeted correction pass):
 *   MyCanvas
 *   ├─ story rail (MyCanvasTab's own — template / stories / Connect Claude)
 *   ├─ active story/editor (MyCanvasTab's own)
 *   └─ aigentMe pane (this component's second column)
 *       └─ Shape your story constitutional capsule
 *           (ConstitutionalAgentDispositionSurface, wrapped in LayoutShell —
 *           the SAME Horizen Threshold Guide capsule chrome used elsewhere)
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';
import { takeCiBridgeRemixIntent } from '@/services/journey/ciBridgeRemixIntent';
import { ConstitutionalAgentDispositionSurface } from '@/components/journey/ConstitutionalAgentDispositionSurface';
import { LayoutShell } from '@/components/metame/welcome/layouts/LayoutShell';

interface Props {
  personaId?: string;
}

const ROLE_LABELS: Record<string, string> = {
  guide: 'Guide',
  researcher: 'Researcher',
  operator: 'Operator',
  'creative-collaborator': 'Creative collaborator',
  'financial-assistant': 'Financial assistant',
  'advocate-safeguard': 'Advocate / safeguard',
  other: 'Other',
};

export function ConstitutionalInternetBridgePersonifyMyCanvas({ personaId }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dispositionAnswered, setDispositionAnswered] = useState(false);
  const [dispositionRole, setDispositionRole] = useState<string | null>(null);
  // Read-and-clear exactly ONCE per mount (lazy initializer, not the effect
  // below) — the effect re-runs every time `expanded` toggles, and
  // takeCiBridgeRemixIntent() clears sessionStorage on read, so re-reading
  // it there would drop the payload the moment the visitor toggled
  // Focus/Explore after the first render.
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
    <div className="flex flex-col gap-3 lg:flex-row">
      {/* LEFT — Shape your story prep pane; collapses away after answer */}
      <div
        className={`min-h-0 transition-all duration-300 lg:flex-[2] ${
          dispositionAnswered ? 'hidden lg:hidden' : 'flex-1 flex'
        } flex-col`}
      >
        <div className="h-[calc(100vh-200px)]">
          <LayoutShell
            surfaceId="ci-bridge-personify-disposition"
            disTemplateId="ci-bridge-personify-disposition-v1"
            headerIcon={<Sparkles className="h-3.5 w-3.5" />}
            headerEyebrow="aigentMe"
            headerTitle="Shape your story"
            body={
              <ConstitutionalAgentDispositionSurface
                onResolved={(disposition) => {
                  setDispositionRole(disposition.role);
                  setDispositionAnswered(true);
                }}
              />
            }
          />
        </div>
      </div>

      {/* RIGHT — myCanvas editor */}
      <div className={`flex min-h-0 flex-1 flex-col gap-1.5 ${dispositionAnswered ? 'lg:flex-1' : 'lg:flex-[3]'}`}>
        {/* Current disposition pill — visible when answered and pane is collapsed */}
        {dispositionAnswered && dispositionRole && (
          <button
            onClick={() => setDispositionAnswered(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-left text-xs text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/20"
          >
            <span className="font-medium">Your disposition:</span>
            <span className="font-semibold text-indigo-100">{ROLE_LABELS[dispositionRole] || dispositionRole}</span>
            <span className="ml-auto shrink-0 text-indigo-300/60">← Edit</span>
          </button>
        )}

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
          className={`w-full rounded-md border border-slate-800 bg-slate-950 ${
            dispositionAnswered ? 'h-[calc(100vh-180px)]' : 'h-[calc(100vh-200px)]'
          }`}
        />
      </div>
    </div>
  );
}

export default ConstitutionalInternetBridgePersonifyMyCanvas;
