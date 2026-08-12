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
 *
 * Focused surface-polish pass (2026-08-10): since this surface builds its
 * own URL rather than going through a registry `embed` descriptor, it can't
 * pick up JourneyRunSurface's shared `focused` treatment automatically —
 * it applies the same `focused: true` option (utils/codex-nav.ts) and the
 * same taller-viewport + "Explore metaMe ↗" affordance by hand, so myCanvas
 * reads identically to VIEW/STAND/BUY: metaMe's top estate navigation is
 * suppressed, myCanvas's own local navigation is untouched.
 *
 * PASSPORT GATE (2026-08-12, KNYTS↔CI parity pass) — mirrors CI's
 * Personify fix: the page-level `journey:select-stage` listener cannot
 * actually gate this surface (JourneyRunSurface's own stepper switches the
 * active stage before dispatching that event), so this surface fails
 * closed itself, from the authoritative `citizenPassportUsable` signal.
 * `undefined` (not yet resolved) is treated as NOT usable.
 */

import { useEffect, useState } from 'react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';
import { BridgePassportGate } from '@/components/journey/BridgePassportGate';

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

interface Props {
  personaId?: string;
  /** Authoritative — see file header. Undefined = not yet resolved = gated. */
  citizenPassportUsable?: boolean;
}

export function KnytsBridgeRemixSurface({ personaId, citizenPassportUsable }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [publicSrc, setPublicSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [gateOpen, setGateOpen] = useState(true);

  const passportUsable = citizenPassportUsable === true;

  useEffect(() => {
    if (!passportUsable) setGateOpen(true);
  }, [passportUsable]);

  useEffect(() => {
    if (!passportUsable) {
      setSrc(null);
      setPublicSrc(buildCodexUrl('metame-codex', { tab: 'metame-web', shell: 'embed', suppressCopilot: true, focused: true, focusedNavDepth: 0 }));
      return;
    }
    setPublicSrc(null);

    const pendingRemix = (() => {
      try {
        return new URL(window.location.href).searchParams.get('remix');
      } catch {
        return null;
      }
    })();

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
        url.searchParams.set('campaignTag', KNYTS_BRIDGE_CAMPAIGN_ID);
        if (pendingRemix) url.searchParams.set('remix', pendingRemix);
        return url.pathname + url.search;
      } catch {
        return base;
      }
    };

    // Lite: focused=true when not expanded; Full: focused=false when expanded
    setSrc(expanded ? buildSrcForMode(false) : buildSrcForMode(true));
  }, [personaId, expanded, passportUsable]);

  if (!passportUsable) {
    return (
      <div className="relative h-[calc(100vh-200px)] w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950">
        {publicSrc && (
          <iframe src={publicSrc} title="metaMe" className="h-full w-full border-0" />
        )}
        <BridgePassportGate
          isOpen={gateOpen}
          onDismiss={() => setGateOpen(false)}
          onProceedToPassport={() => selectStage('passport')}
          dismissLabel="Later"
          accent="amber"
          headline="Claim Your Passport First"
          explanation="Your Polity Citizen Passport is your constitutional presence. You must establish it before you can remix your crossing."
          points={[
            'Passport proves your constitutional personhood',
            "You'll cross a threshold once claimed",
            'Then remix your crossing story',
          ]}
        />
      </div>
    );
  }

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
        title="Crossing the Threshold — myCanvas"
        className="h-[calc(100vh-200px)] w-full rounded-md border border-slate-800 bg-slate-950"
      />
    </div>
  );
}

export default KnytsBridgeRemixSurface;
