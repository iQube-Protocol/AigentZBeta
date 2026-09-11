'use client';

/**
 * /bridge/ci — the Constitutional Internet Bridge public front door:
 * Threshold Guide.
 *
 * Sibling of app/bridge/knyts/page.tsx on the SAME shared Guided Journey
 * Runtime runner (components/journey/JourneyRunSurface.tsx) — the Threshold
 * Guide is a product, not a KNYTS feature. KNYTS speaks Mythos through it;
 * this page speaks Ethos. They share: JourneyRunSurface, the Posit Spine,
 * the compact one-row header, the authoritative journey-state model, the
 * surface registry, the focused/full canonical-surface presentation, and
 * the one-guide/copilot rule. What differs is the journey definition
 * (services/journey/constitutionalInternetBridgeJourney.ts), its surfaces,
 * its accent (indigo, not KNYT amber), and its copilot identity.
 *
 * Surface map (see services/journey/journeySurfaceRegistry.ts's CI section
 * for the full reuse rationale) — evolved 2026-08-11, experience enrichment
 * pass (NOT a reconstitution — the scaffold below is unchanged):
 *   HOME      → ConstitutionalInternetBridgeMediaStage (admin-configurable
 *               media wrapper around the existing BridgeMediaStage)
 *   VIEW      → ConstitutionalInternetBridgeViewSequence (Ethos | Crossings)
 *   ORIENT    → ConstitutionalInternetBridgeOrientIntro (media header +
 *               the existing, untouched ConstitutionalFrontierOrientSurface)
 *   PASSPORT  → ConstitutionalInternetBridgePassportRoom (state-aware:
 *               claim, or "you have crossed" + continue to PERSONIFY)
 *   PERSONIFY → ConstitutionalInternetBridgePersonifyMyCanvas (primary:
 *               "Tell your Constitutional story") + ConstitutionalAgent
 *               FieldEntrySurface (supporting: Connect Claude / Meet
 *               aigentMe) — renamed from ACT, capabilities preserved
 *   STAND     → ConstitutionalInternetBridgeStandPanel (real receipts + Standing)
 *   CHOOSE    → ConstitutionalInternetBridgeChooseSurface (destinations)
 *
 * This page hosts Passport sign-in itself (usePassportSignInHost +
 * PassportConnectPanel, the same surface /invite/[code]/page.tsx and
 * app/bridge/knyts/page.tsx use directly) because a bare page has no
 * SmartWalletDrawer anywhere in its tree to answer a PASSPORT_SIGN_IN
 * request otherwise — structural parity with KNYTS even though no CI
 * surface currently issues such a request (none needs to: PASSPORT is a
 * proper spine stage before PERSONIFY, reached in order).
 *
 * JOURNEY RUNTIME COPILOT INVARIANT (item 1, semantic repair 2026-08-25) —
 * the single floating copilot is no longer mounted here by hand. It is now
 * `JourneyCopilotHost`, mounted once from the shared `JourneyRunSurface`
 * runner itself, resolving the SAME existing canonical aigentMe identity
 * (data/codex-configs.ts's METAME_CODEX.copilot: agent id 'aigent-me',
 * accent emerald) from `CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.copilot` —
 * never hand-copied here anymore, and never an invented "aigent-ci"
 * identity. The PERSONIFY aigentMe embed still suppresses its OWN floating
 * copilot (suppressCopilot on that iframe) so this remains the only one on
 * screen.
 *
 * Bridge Admin (added 2026-08-11) mirrors KNYTS Bridge's admin panel
 * exactly — same table, same route, same KnytsBridgeAdminPanel component
 * (with bridgeLabel="Constitutional Internet Bridge" so it doesn't show
 * KNYTS branding), listing CI's own editorial sections: ci-home, ci-orient,
 * and one ci-view-<blockId> row per Ethos vignette (video-slot only — see
 * ConstitutionalInternetBridgeViewSequence's own header for why vignette
 * order/plate/excerpt/paper stay code-defined this pass).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { JourneyRunSurface, type JourneyRunSurfaceProps } from '@/components/journey/JourneyRunSurface';
import { openJourneyCopilot } from '@/components/journey/JourneyCopilotHost';
import type { JourneyRuntimeState } from '@/types/journey';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { resolveFinancialServicesEntryPresentation } from '@/services/journey/financialServicesEntryPresentation';
import { CI_BRIDGE_VIEW_CONTENT } from '@/services/journey/constitutionalInternetBridgeViewContent';
import { ConstitutionalInternetBridgeMediaStage } from '@/components/journey/ConstitutionalInternetBridgeMediaStage';
import { ConstitutionalInternetBridgeViewSequence } from '@/components/journey/ConstitutionalInternetBridgeViewSequence';
import { ConstitutionalInternetBridgeOrientIntro } from '@/components/journey/ConstitutionalInternetBridgeOrientIntro';
import { ConstitutionalInternetBridgePassportRoom } from '@/components/journey/ConstitutionalInternetBridgePassportRoom';
import { ConstitutionalInternetBridgePersonifyMyCanvas } from '@/components/journey/ConstitutionalInternetBridgePersonifyMyCanvas';
import { ConstitutionalInternetBridgeStandPanel } from '@/components/journey/ConstitutionalInternetBridgeStandPanel';
import { ConstitutionalInternetBridgeChooseSurface } from '@/components/journey/ConstitutionalInternetBridgeChooseSurface';
import { KnytsBridgeAdminPanel } from '@/components/journey/KnytsBridgeAdminPanel';
import { FinancialSovereigntyIntroStage } from '@/components/journey/FinancialSovereigntyIntroStage';
import { FinancialSovereigntyPrepareCrossStage } from '@/components/journey/FinancialSovereigntyPrepareCrossStage';
import { FinancialSovereigntyOperateStage } from '@/components/journey/FinancialSovereigntyOperateStage';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { usePersonaSpine } from '@/utils/personaSpine';
import { MetaAvatarProvider } from '@/app/contexts/MetaAvatarContext';
import { MetaAvatarHost } from '@/app/components/metaVatar/MetaAvatarHost';

/** CI visual projection — indigo, never a change to JourneyRunSurface's own
 *  default (purple), which every other journey keeps. */
const CI_ACCENT = {
  node: 'border-indigo-400 bg-indigo-500/20 text-indigo-200',
  label: 'text-indigo-200',
  chip: 'bg-indigo-500/20 text-indigo-200',
};

const CI_BRIDGE_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  ConstitutionalInternetBridgeMediaStage,
  ConstitutionalInternetBridgeViewSequence,
  ConstitutionalInternetBridgeOrientIntro,
  ConstitutionalInternetBridgePassportRoom,
  ConstitutionalInternetBridgePersonifyMyCanvas,
  ConstitutionalInternetBridgeStandPanel,
  ConstitutionalInternetBridgeChooseSurface,
  FinancialSovereigntyIntroStage: FinancialSovereigntyIntroStage as unknown as React.ComponentType<Record<string, unknown>>,
  FinancialSovereigntyPrepareCrossStage: FinancialSovereigntyPrepareCrossStage as unknown as React.ComponentType<Record<string, unknown>>,
  FinancialSovereigntyOperateStage: FinancialSovereigntyOperateStage as unknown as React.ComponentType<Record<string, unknown>>,
};

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

export default function ConstitutionalInternetBridgePage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  const [adminOpen, setAdminOpen] = useState(false);
  // Derived exclusively from `onRuntimeStateChange` below — never as a side
  // effect of `resolveSurfaceProps` while the Passport room happens to be
  // the active surface (CFS-055 coherence pass, 2026-08-12: state coherence
  // must not depend on which stage is on screen).
  const [citizenPassportUsable, setCitizenPassportUsable] = useState<boolean | undefined>(undefined);
  const spine = usePersonaSpine();

  // Bridge CHOOSE CTA refinement (2026-09-01) — the SAME shared, evidence-
  // derived presentation the KNYTS Bridge page resolves, never a local
  // heuristic. See financialServicesEntryPresentation.ts.
  const [financialServicesEntryPresentation, setFinancialServicesEntryPresentation] = useState(
    resolveFinancialServicesEntryPresentation(undefined),
  );

  const handleRuntimeStateChange = useCallback((state: JourneyRuntimeState) => {
    const passportStage = state.stages.find((s) => s.stageId === 'passport');
    setCitizenPassportUsable(Boolean(passportStage?.evidencePresent.includes('citizenPassportUsable')));
    setFinancialServicesEntryPresentation(resolveFinancialServicesEntryPresentation(state));
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('currentPersonaId');
      if (stored) setPersonaId(stored);
    } catch {
      /* storage unavailable — stays signed-out */
    }
  }, []);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost('ConstitutionalInternetBridgeFrontDoor');

  // Consumes `citizenPassportUsable` (derived above from the WHOLE
  // runtimeState via onRuntimeStateChange) — never discovers it.
  const resolveSurfaceProps = useCallback(
    ({ surfaceRef, requestStateRefresh }: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => {
      if (surfaceRef.ref === 'ci-bridge-passport-room') {
        return {
          citizenPassportUsable,
          personaId,
          requestStateRefresh,
        };
      }
      if (surfaceRef.ref === 'ci-bridge-home') {
        return {
          onPrimaryCta: () => selectStage('view'),
          onSecondaryCta: () => selectStage('choose'),
        };
      }
      if (surfaceRef.ref === 'ci-bridge-choose') {
        // "Meet aigentMe" opens the SAME floating Copilot mounted once by
        // JourneyRunSurface's JourneyCopilotHost (targeted correction pass,
        // 2026-08-11; re-pointed at the shared host 2026-08-25) — never a
        // second embedded metaMe surface. This is the existing personaId-
        // drilling channel (resolveSurfaceProps), just one more callback.
        return { personaId, onOpenAigentMeCopilot: openJourneyCopilot, financialServicesEntryPresentation };
      }
      if (surfaceRef.ref === 'ci-bridge-view') {
        return { personaId };
      }
      if (surfaceRef.ref === 'ci-bridge-fs-discover') {
        return { stageKey: 'discover', accent: 'indigo', nextStageId: 'fs-learn', journeyId: 'constitutional-internet-bridge', personaId };
      }
      if (surfaceRef.ref === 'ci-bridge-fs-learn') {
        return { stageKey: 'learn', accent: 'indigo', nextStageId: 'fs-explore', journeyId: 'constitutional-internet-bridge', personaId };
      }
      if (surfaceRef.ref === 'ci-bridge-fs-explore') {
        return { stageKey: 'explore', accent: 'indigo', nextStageId: 'fs-prepare', journeyId: 'constitutional-internet-bridge', personaId };
      }
      if (surfaceRef.ref === 'ci-bridge-fs-prepare') {
        return { mode: 'prepare', accent: 'indigo', sourceJourneyId: 'constitutional-internet-bridge', sourceStageId: 'fs-prepare', nextStageId: 'fs-operate', personaId };
      }
      if (surfaceRef.ref === 'ci-bridge-fs-operate') {
        return { accent: 'indigo', nextStageId: 'fs-cross', personaId };
      }
      if (surfaceRef.ref === 'ci-bridge-fs-cross') {
        return { mode: 'cross', accent: 'indigo', sourceJourneyId: 'constitutional-internet-bridge', sourceStageId: 'fs-cross', returnStageId: 'choose' };
      }
      if (
        // Fixed 2026-08-12 (forensic correction pass) — Personify and Stand
        // must fail closed on the AUTHORITATIVE `citizenPassportUsable`
        // signal (set above, from the Passport-room's own runtime-state
        // read), never on `personaId` alone. A signed-in visitor without a
        // claimed Passport is exactly the case that produced the blank
        // Stand screen and the un-gated Personify myCanvas mount.
        surfaceRef.ref === 'ci-bridge-personify-mycanvas' ||
        surfaceRef.ref === 'ci-bridge-stand'
      ) {
        return { personaId, citizenPassportUsable };
      }
      return {};
    },
    [personaId, citizenPassportUsable, financialServicesEntryPresentation],
  );

  return (
    // MetaAvatarProvider wraps this page explicitly, same fix KNYTS Bridge
    // needed (2026-08-10): CodexCopilotLayer's useMetaAvatar() throws
    // without one, and this bare page sits outside both app/(shell)/layout.tsx
    // and app/(embed)/layout.tsx — the only two places that layout normally
    // supplies it.
    <MetaAvatarProvider defaultAgent="aigent-me">
      <div className="h-screen bg-slate-950 text-slate-100">
        <JourneyRunSurface
          journey={CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY}
          stateUrl="/api/journey/constitutional-internet-bridge/state"
          personaId={personaId}
          documentTitle="The Constitutional Internet Bridge — Threshold Guide"
          components={CI_BRIDGE_COMPONENTS}
          resolveSurfaceProps={resolveSurfaceProps}
          onRuntimeStateChange={handleRuntimeStateChange}
          onPersonaChange={setPersonaId}
          accent={CI_ACCENT}
          compact
          distinguishAvailableStages
          // CI-specific presentation seam (gating polish pass, 2026-08-12) —
          // see JourneyRunSurface's emphasizeAvailableStage doc. Home/View/
          // Orient/Choose are all available WITHOUT a Passport — none of
          // them require personhood merely to be explored, so all four keep
          // the emerald "available now" look. Personify and Stand alone are
          // personhood-bound (MyCanvas/Standing require a claimed Passport);
          // before that, painting THEM emerald falsely reads as
          // "constitutionally established". Choose was wrongly included in
          // this branch in the prior pass — Continue reading / Meet aigentMe
          // / Join IRL / Partner with metaMe / Share the Bridge are all
          // selectable without a Passport, so Choose must never depend on
          // citizenPassportUsable. Passport itself is unaffected — its color
          // comes from isDone/isCurrent, not this callback.
          emphasizeAvailableStage={(stageId) => {
            if (stageId === 'personify' || stageId === 'stand') {
              return citizenPassportUsable === true;
            }
            return true;
          }}
          headerLabel={
            <>
              <span className="shrink-0 font-semibold text-slate-100">Constitutional Internet Bridge</span>
              <span className="shrink-0 text-slate-600">·</span>
              <span className="truncate text-indigo-300">Threshold Guide</span>
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

        {/* PASSPORT — hosted inline for whichever surface above requested it.
            No CI surface currently issues this request (Passport is a proper
            spine stage reached in order), but the mechanism stays mounted
            for structural parity with KNYTS and any future gated action. */}
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
                  selectStage('personify');
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

        {/* Bridge Admin — mirrors app/bridge/knyts/page.tsx's own modal
            exactly: same table, same route, same KnytsBridgeAdminPanel
            component (bridgeLabel swapped so the heading says the right
            bridge), server-enforced by the editorial-config PUT route's own
            requireAdminPersona check — this client gate is optimistic UX
            only. */}
        {adminOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="text-sm font-semibold text-slate-100">Bridge Admin</span>
                <button type="button" onClick={() => setAdminOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">
                  Close
                </button>
              </div>
              <KnytsBridgeAdminPanel section="ci-home" personaId={personaId} bridgeLabel="Constitutional Internet Bridge" />
              <div className="border-t border-white/10">
                <KnytsBridgeAdminPanel section="ci-orient" personaId={personaId} bridgeLabel="Constitutional Internet Bridge" />
              </div>
              <div className="border-t border-white/10">
                <KnytsBridgeAdminPanel section="ci-passport-established" personaId={personaId} bridgeLabel="Constitutional Internet Bridge" />
              </div>
              {CI_BRIDGE_VIEW_CONTENT.map((block) => (
                <div key={block.id} className="border-t border-white/10">
                  <KnytsBridgeAdminPanel
                    section={`ci-view-${block.id}`}
                    personaId={personaId}
                    bridgeLabel="Constitutional Internet Bridge"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      {/* Root cause of the blank Copilot metaVatar (2026-08-11, targeted
          correction pass #98): MetaAvatarProvider above supplies context so
          useMetaAvatar() doesn't throw, but the actual <MetaAvatar/> mount
          gate previously existed ONLY inside app/(shell)/layout.tsx and
          app/(embed)/layout.tsx — neither of which wraps this bare top-level
          route. requestAvatar('codexCopilot', ...) updated context state
          exactly as designed; nothing ever mounted the component the state
          change implies should appear. See MetaAvatarHost.tsx. */}
      <MetaAvatarHost />
    </MetaAvatarProvider>
  );
}
