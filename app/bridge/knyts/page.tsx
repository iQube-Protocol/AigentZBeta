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
 *   HOME/ORIENT → KnytsBridgeMediaStage (the one net-new cinematic surface)
 *   VIEW/STAND/BUY → embeds of the canonical KNYT Pulse/Quests/Store tabs
 *   PASSPORT → KnytsBridgePassportRoom (state-aware: claim, or meet/delegate
 *             to aigentMe once established)
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
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { KnytsBridgeMediaStage } from '@/components/journey/KnytsBridgeMediaStage';
import { KnytsBridgePassportRoom } from '@/components/journey/KnytsBridgePassportRoom';
import { KnytsBridgeRemixSurface } from '@/components/journey/KnytsBridgeRemixSurface';
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
  KnytsBridgePassportRoom,
  KnytsBridgeRemixSurface,
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

export default function KnytsBridgePage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  const [adminOpen, setAdminOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [previousStageId, setPreviousStageId] = useState<string | undefined>(undefined);
  const [currentStageId, setCurrentStageId] = useState<string | undefined>(undefined);
  const spine = usePersonaSpine();

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

  // Track stage navigation for back button functionality
  useEffect(() => {
    const handleStageSelect = (event: Event) => {
      const customEvent = event as CustomEvent<{ stageId: string }>;
      setPreviousStageId(currentStageId);
      setCurrentStageId(customEvent.detail.stageId);
    };
    window.addEventListener('journey:select-stage', handleStageSelect);
    return () => window.removeEventListener('journey:select-stage', handleStageSelect);
  }, [currentStageId]);

  const handleBack = useCallback(() => {
    if (previousStageId) {
      selectStage(previousStageId);
    }
  }, [previousStageId]);

  const resolveSurfaceProps = useCallback(
    ({ surfaceRef, runtimeState }: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => {
      if (surfaceRef.ref === 'knyts-bridge-passport-room') {
        const passportStage = runtimeState?.stages.find((s) => s.stageId === 'passport');
        return { citizenPassportUsable: passportStage?.evidencePresent.includes('citizenPassportUsable') };
      }
      return {};
    },
    [],
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
        accent={KNYT_ACCENT}
        compact
        onBack={handleBack}
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
