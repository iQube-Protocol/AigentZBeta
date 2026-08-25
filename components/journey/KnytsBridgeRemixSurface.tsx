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
 *
 * MYCANVAS ACTIVATION (item 8, semantic repair 2026-08-25) — `mycanvas` is
 * an "open" activation-catalog entry (data/activation-catalog.ts): eligible
 * to self-activate, but `services/activations/spineActivations.ts` never
 * auto-grants it on a mere read. A Passport-qualified visitor who reached
 * this far was landing on the generic `metame-web` (metaMe.com) fallback
 * not because of a Passport problem, but because `mycanvas` had genuinely
 * never been activated for them — `CodexPanelDynamic`'s tab gate was
 * correctly denying a tab this surface never granted. The fix: ensure the
 * activation via the existing, idempotent `useActivations().activate(id)`
 * (ActivationsContext — the SAME store `ActivationsTab`/the top menu use,
 * never a second write path) BEFORE building the `tab=mycanvas` iframe src,
 * and wait for confirmed-or-optimistic `active` status first. `mycanvas`
 * activation state is per-persona, not per-page, so `ActivationsProvider`
 * is mounted locally here (personaId override — this is a bare page outside
 * the normal shell, same reasoning as `MetaAvatarProvider` elsewhere in the
 * Bridge pages) rather than assuming one already wraps this tree.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';
import { BridgePassportGate } from '@/components/journey/BridgePassportGate';
import { ActivationsProvider, useActivations } from '@/services/activations/ActivationsContext';

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

export function KnytsBridgeRemixSurface(props: Props) {
  return (
    <ActivationsProvider personaId={props.personaId}>
      <KnytsBridgeRemixSurfaceInner {...props} />
    </ActivationsProvider>
  );
}

function KnytsBridgeRemixSurfaceInner({ personaId, citizenPassportUsable }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [publicSrc, setPublicSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [gateOpen, setGateOpen] = useState(true);

  const passportUsable = citizenPassportUsable === true;

  const { activeIds, isMutating, loading: activationsLoading, activate, error: activationError } = useActivations();
  const mycanvasActive = activeIds.has('mycanvas');
  const mycanvasActivating = isMutating('mycanvas');
  // "Not confirmed active yet" (MS-11: a not-yet-hydrated cache must never
  // answer as if it were a confirmed "no") — covers the initial fetch, the
  // ensure-activation mutation itself, and the brief gap between them.
  const mycanvasPending = activationsLoading || mycanvasActivating || (!mycanvasActive && !activationError);

  useEffect(() => {
    if (!passportUsable) setGateOpen(true);
  }, [passportUsable]);

  // Ensure the open `mycanvas` activation, idempotently, for this same
  // active persona — exactly once it's known NOT already active, never on
  // every render (activate() below is itself idempotent server-side too,
  // but this guard also avoids a duplicate in-flight mutation).
  useEffect(() => {
    if (!passportUsable || activationsLoading || mycanvasActive || mycanvasActivating) return;
    void activate('mycanvas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportUsable, activationsLoading, mycanvasActive, mycanvasActivating]);

  useEffect(() => {
    if (!passportUsable) {
      setSrc(null);
      setPublicSrc(buildCodexUrl('metame-codex', { tab: 'metame-web', shell: 'embed', suppressCopilot: true, focused: true, focusedNavDepth: 0 }));
      return;
    }
    setPublicSrc(null);

    // Wait for confirmed (or optimistic) activation before deep-linking
    // myCanvas — never mount the iframe against a tab CodexPanelDynamic will
    // correctly filter back out because the activation hasn't landed yet.
    if (!mycanvasActive) {
      setSrc(null);
      return;
    }

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
  }, [personaId, expanded, passportUsable, mycanvasActive]);

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

  // Passport-qualified and eligible for the open myCanvas activation —
  // never the metaMe.com fallback from here on, only a brief opening state
  // (or an explicit retry if the activation write itself failed).
  if (mycanvasPending) {
    return (
      <div className="flex h-[calc(100vh-200px)] w-full flex-col items-center justify-center gap-2 rounded-md border border-slate-800 bg-slate-950 text-sm text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Opening myCanvas…
      </div>
    );
  }
  if (activationError && !mycanvasActive) {
    return (
      <div className="flex h-[calc(100vh-200px)] w-full flex-col items-center justify-center gap-3 rounded-md border border-slate-800 bg-slate-950 text-sm text-slate-400">
        <p>Couldn&apos;t open myCanvas.</p>
        <button
          onClick={() => void activate('mycanvas')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
        >
          Retry
        </button>
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
