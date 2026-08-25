'use client';

/**
 * /bridge/knyts — The KNYTS Bridge public front door: Threshold Guide.
 *
 * Reconstituted (2026-08-09) onto the shared Guided Journey Runtime runner
 * (components/journey/JourneyRunSurface.tsx) — the SAME Posit Spine grammar
 * Horizen and the Validation Programme use, themed amber/gold via the
 * runner's `accent` prop, header-compressed via `compact`, and projected in
 * Mythos language rather than evidentiary/technical language.
 *
 * Surface reconciliation (2026-08-09, third pass) — KNYTS Bridge is a
 * surface-level constitutional guide into two deeper worlds (the KNYT
 * cartridge and metaMe/aigentMe), not a viewer that reimplements slices of
 * either. Every node now opens a real existing destination surface:
 *   HOME → KnytsBridgeMediaStage, ORIENT → KnytsBridgeOrientIntro (split
 *          2026-08-12, KNYTS↔CI parity pass — both thin amber-preset
 *          wrappers over the SAME bridge-neutral BridgeMediaStage /
 *          BridgeOrientSurface CI's own HOME/ORIENT compose)
 *   VIEW/STAND/BUY → embeds of the canonical KNYT Pulse/Quests/Store tabs
 *   PASSPORT → KnytsBridgePassportRoom (state-aware: claim, or a dismissible
 *             "you have crossed" banner + the shared BridgeActionModeQuestion
 *             signal question, mirroring CI's own Passport room exactly)
 *   REMIX → KnytsBridgeRemixSurface, deep-linked into myCanvas inside the
 *           metaMe/aigentMe environment
 * See services/journey/journeySurfaceRegistry.ts's KNYTS Bridge section for
 * the full reuse map.
 *
 * This page hosts Passport sign-in itself (usePassportSignInHost +
 * PassportConnectPanel, the same surface /invite/[code]/page.tsx uses
 * directly) because a bare page has no SmartWalletDrawer anywhere in its
 * tree to answer a PASSPORT_SIGN_IN request otherwise — the proven
 * interrupt/resume mechanism (RemixCrossingButton's usePassportSignInGate,
 * KnytCommunityContentTab.tsx) is unchanged; only the Posit Spine's active
 * stage is now kept in step with it.
 *
 * A single floating KNYT copilot (CodexCopilotLayer, the same
 * agent/accent config the KNYT cartridge itself uses — data/codex-configs.ts
 * KNYT_CODEX.copilot) is mounted once here and stays the ONE conversational
 * partner throughout every stage (MS-1) — every embedded cartridge tab
 * (VIEW/STAND/BUY) suppresses its own via the registry's
 * `suppressFloatingCopilot`, so the visitor never sees two.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { JourneyRunSurface, type JourneyRunSurfaceProps } from '@/components/journey/JourneyRunSurface';
import type { JourneyRuntimeState } from '@/types/journey';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { KnytsBridgeMediaStage } from '@/components/journey/KnytsBridgeMediaStage';
import { KnytsBridgeOrientIntro } from '@/components/journey/KnytsBridgeOrientIntro';
import { KnytsBridgePassportRoom } from '@/components/journey/KnytsBridgePassportRoom';
import { KnytsBridgeRemixSurface } from '@/components/journey/KnytsBridgeRemixSurface';
import { KnytsBridgeChooseSurface } from '@/components/journey/KnytsBridgeChooseSurface';
import { KnytsBridgeAdminPanel } from '@/components/journey/KnytsBridgeAdminPanel';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { usePersonaSpine } from '@/utils/personaSpine';
import { CodexCopilotLayer } from '@/app/components/codex/CodexCopilotLayer';
import { MetaAvatarProvider } from '@/app/contexts/MetaAvatarContext';
import { MetaAvatarHost } from '@/app/components/metaVatar/MetaAvatarHost';

/** KNYT visual projection — amber/gold, never a change to JourneyRunSurface's
 *  own default (purple), which every other journey keeps. Same accent the
 *  KNYT cartridge's own copilot uses (data/codex-configs.ts). */
const KNYT_ACCENT = {
  node: 'border-amber-400 bg-amber-500/20 text-amber-200',
  label: 'text-amber-200',
  chip: 'bg-amber-500/20 text-amber-200',
};

const KNYTS_BRIDGE_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  KnytsBridgeMediaStage,
  KnytsBridgeOrientIntro,
  KnytsBridgePassportRoom,
  KnytsBridgeRemixSurface,
  KnytsBridgeChooseSurface,
};

const KNYT_COPILOT_QUICK_PROMPTS = [
  'What does this mean?',
  'What should I do?',
  'How do I write my Crossing Story?',
];

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

/**
 * MONOTONIC TRUE (KNYTS Remix live defect, 2026-08-21) — defense-in-depth
 * on top of JourneyRunSurface's request-ordering guard (that component's
 * own header), not a substitute for it. `CitizenPassportStatus` has no
 * denied/revoked transition in an ordinary session (lifecycle/continuity
 * states only — see services/passport/issuanceService.ts) — so once THIS
 * client has observed a usable Citizen Passport, a later runtime-state read
 * reporting it absent is never a legitimate in-session revocation. Treating
 * it as one is exactly what let a transient/out-of-order read regress
 * `citizenPassportUsable` back to false right as a visitor moved from
 * Passport into Remix, rendering the public `metame-web` fallback instead
 * of myCanvas for a citizen who had already crossed the threshold.
 *
 * Exported so this specific merge rule — not the whole page — is directly
 * unit-testable without a render harness.
 */
export function mergeCitizenPassportUsable(previous: boolean | undefined, observedNow: boolean): boolean {
  return previous === true ? true : observedNow;
}

export default function KnytsBridgePage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  const [adminOpen, setAdminOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const spine = usePersonaSpine();
  // Authoritative runtime-state signal (2026-08-12, KNYTS↔CI parity pass;
  // re-derived CFS-055 coherence pass, same day). Previously discovered as
  // a SIDE EFFECT of `resolveSurfaceProps` while the Passport room happened
  // to be the active surface — brittle, because state coherence then
  // depended on which stage was on screen. Now derived exclusively from
  // `onRuntimeStateChange` below, which fires from the WHOLE resolved
  // runtimeState on every refresh, active stage notwithstanding. Drives the
  // Passport room, the stepper's emphasizeAvailableStage projection, and
  // the Remix/Stand gate listener — one value, one source. Merged through
  // `mergeCitizenPassportUsable` (this file, above) on every update — see
  // that function's own header for why a merge, not a plain assignment.
  const [citizenPassportUsable, setCitizenPassportUsable] = useState<boolean | undefined>(undefined);

  const handleRuntimeStateChange = useCallback((state: JourneyRuntimeState) => {
    const passportStage = state.stages.find((s) => s.stageId === 'passport');
    const observedNow = Boolean(passportStage?.evidencePresent.includes('citizenPassportUsable'));
    setCitizenPassportUsable((prev) => mergeCitizenPassportUsable(prev, observedNow));
  }, []);

  // Same pinned-persona read every top-level surface uses as its baseline
  // (personaFetch's own fallback, MetaMeRuntimeClient's resolver).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('currentPersonaId');
      if (stored) setPersonaId(stored);
    } catch {
      /* storage unavailable — stays signed-out */
    }
  }, []);

  // Resume an interrupted Remix intent: RemixCrossingButton (inside this
  // page's VIEW stage) targets `/bridge/knyts?remix=<payload>` when already
  // on this page, so landing here with that param present means "put the
  // spine on REMIX" — KnytsBridgeRemixSurface reads the same param to build
  // its iframe src.
  useEffect(() => {
    try {
      if (new URL(window.location.href).searchParams.has('remix')) {
        selectStage('remix');
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost('KnytsBridgeFrontDoor');

  // Keep the spine's active stage in step with the interrupt modal, so it
  // never shows a stage the visitor has already moved past.
  useEffect(() => {
    if (showPassportSignIn) selectStage('passport');
  }, [showPassportSignIn]);


  // Consumes `citizenPassportUsable` (derived above from the WHOLE
  // runtimeState via onRuntimeStateChange) — never discovers it. See that
  // state's own comment for why this split matters (CFS-055 coherence
  // pass, 2026-08-12).
  const resolveSurfaceProps = useCallback(
    ({ surfaceRef, requestStateRefresh }: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => {
      if (surfaceRef.ref === 'knyts-bridge-passport-room') {
        return { citizenPassportUsable, personaId, requestStateRefresh };
      }
      if (surfaceRef.ref === 'knyts-bridge-mycanvas-remix') {
        return { personaId, citizenPassportUsable };
      }
      if (surfaceRef.ref === 'knyts-bridge-choose') {
        return { personaId, onOpenKnytCopilot: () => setCopilotOpen(true) };
      }
      return {};
    },
    [personaId, citizenPassportUsable],
  );

  return (
    // MetaAvatarProvider wraps this page explicitly (surface reconciliation
    // build fix, 2026-08-10): CodexCopilotLayer's useMetaAvatar() throws
    // without one, and this bare page sits outside both app/(shell)/layout.tsx
    // and app/(embed)/layout.tsx — the only two places that layout normally
    // supplies it — so it crashed Amplify's static prerender of /bridge/knyts
    // (and would have crashed the same way for every real visitor who opened
    // the copilot, not just the build). The provider is a lightweight,
    // self-contained context (local state only) — mounting a second instance
    // here is safe and matches the KNYT copilot's own default agent.
    <MetaAvatarProvider defaultAgent="aigent-kn0w1">
    <div className="h-screen bg-slate-950 text-slate-100">
      <JourneyRunSurface
        journey={KNYTS_BRIDGE_CROSSING_JOURNEY}
        stateUrl="/api/journey/knyts-bridge/state"
        personaId={personaId}
        documentTitle="The KNYTS Bridge — Threshold Guide"
        components={KNYTS_BRIDGE_COMPONENTS}
        resolveSurfaceProps={resolveSurfaceProps}
        onRuntimeStateChange={handleRuntimeStateChange}
        onPersonaChange={setPersonaId}
        accent={KNYT_ACCENT}
        compact
        distinguishAvailableStages
        // KNYTS-specific presentation seam (2026-08-12, KNYTS↔CI parity
        // pass) — mirrors CI's own emphasizeAvailableStage exactly. Home/
        // View/Orient/Buy are all publicly available, so they keep the
        // emerald "available now" look. Remix and Stand alone are
        // Passport-bound (no requirement to complete Remix before entering
        // Stand — both gate on Passport independently, never on each
        // other). Passport itself is unaffected — its color comes from
        // isDone/isCurrent, not this callback.
        emphasizeAvailableStage={(stageId) => {
          if (stageId === 'remix' || stageId === 'stand') {
            return citizenPassportUsable === true;
          }
          return true;
        }}
        headerLabel={
          <>
            <span className="shrink-0 font-semibold text-slate-100">KNYTS Bridge</span>
            <span className="shrink-0 text-slate-600">·</span>
            <span className="truncate text-amber-300">Threshold Guide</span>
          </>
        }
        headerExtra={
          spine.cartridgeFlags.isAdmin ? (
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              title="Bridge Admin"
              className="flex shrink-0 items-center gap-1 rounded-md border border-slate-800 bg-slate-900/40 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            >
              <Settings className="h-3 w-3" />
              Bridge Admin
            </button>
          ) : undefined
        }
      />

      {/* PASSPORT — hosted inline for the Remix-without-Passport interrupt */}
      {showPassportSignIn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden">
            <PassportConnectPanel
              world="application"
              embedded
              onConnected={() => {
                try {
                  const stored = window.localStorage.getItem('currentPersonaId');
                  if (stored) setPersonaId(stored);
                } catch {
                  /* ignore */
                }
                completeSignIn();
                selectStage('remix');
              }}
            />
            <button
              type="button"
              onClick={dismissSignIn}
              className="w-full border-t border-white/10 px-4 py-2.5 text-[12px] text-slate-400 hover:text-slate-200"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Bridge Admin — replaces the earlier standalone /bridge/knyts/admin
          route (which 404'd) with an in-page modal, server-enforced by the
          editorial-config PUT route's own requireAdminPersona check; this
          client gate is optimistic UX only. */}
      {adminOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-slate-100">Bridge Admin</span>
              <button type="button" onClick={() => setAdminOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">
                Close
              </button>
            </div>
            <KnytsBridgeAdminPanel section="home" personaId={personaId} />
            <div className="border-t border-white/10">
              <KnytsBridgeAdminPanel section="orient" personaId={personaId} />
            </div>
            <div className="border-t border-white/10">
              <KnytsBridgeAdminPanel section="choose" personaId={personaId} />
            </div>
          </div>
        </div>
      )}

      {/* Omnipresent KNYT copilot (surface reconciliation, point on the
          floating copilot) — same agent/accent the KNYT cartridge itself
          uses, so a visitor who later opens the cartridge directly meets
          the same voice. */}
      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        accentColor="amber"
        agent={{ id: 'aigent-kn0w1', name: 'KNYT Copilot' }}
        personaId={personaId}
        enableInferenceRendering
        contextId="knyts-bridge"
        promptPlaceholder="Ask about your crossing..."
        quickPrompts={KNYT_COPILOT_QUICK_PROMPTS}
        groundContext={{
          surface: 'knyts-bridge',
          bridgeTitle: 'The KNYTS Bridge — Threshold Guide',
          stageContent: KNYTS_BRIDGE_CROSSING_JOURNEY.stages.map(stage => ({
            stage: stage.stageId,
            title: stage.stageName,
          })),
        }}
      />

    </div>
    {/* Same missing-mount-gate bug identified on /bridge/ci (2026-08-11,
        targeted correction pass #98) applies here identically: this page
        sits outside app/(shell)/layout.tsx and app/(embed)/layout.tsx, the
        only two places that previously rendered <MetaAvatar/>. See
        MetaAvatarHost.tsx. */}
    <MetaAvatarHost />
    </MetaAvatarProvider>
  );
}
