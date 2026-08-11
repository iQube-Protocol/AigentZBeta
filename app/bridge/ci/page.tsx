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
 * One floating copilot (CodexCopilotLayer) is mounted once here, using the
 * existing canonical aigentMe identity (data/codex-configs.ts's
 * METAME_CODEX.copilot: agent id 'aigent-me', accent emerald) rather than
 * inventing a new "aigent-ci" identity — there is no dedicated CI copilot
 * configured anywhere in this codebase, and aigentMe is the correct
 * existing constitutional guide for this Bridge's subject matter. The new
 * PERSONIFY aigentMe embed suppresses its OWN floating copilot
 * (suppressCopilot on that iframe) so this remains the only one on screen.
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
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { CI_BRIDGE_VIEW_CONTENT } from '@/services/journey/constitutionalInternetBridgeViewContent';
import { ConstitutionalInternetBridgeMediaStage } from '@/components/journey/ConstitutionalInternetBridgeMediaStage';
import { ConstitutionalInternetBridgeViewSequence } from '@/components/journey/ConstitutionalInternetBridgeViewSequence';
import { ConstitutionalInternetBridgeOrientIntro } from '@/components/journey/ConstitutionalInternetBridgeOrientIntro';
import { ConstitutionalInternetBridgePassportRoom } from '@/components/journey/ConstitutionalInternetBridgePassportRoom';
import { ConstitutionalInternetBridgePersonifyMyCanvas } from '@/components/journey/ConstitutionalInternetBridgePersonifyMyCanvas';
import { ConstitutionalInternetBridgeStandPanel } from '@/components/journey/ConstitutionalInternetBridgeStandPanel';
import { ConstitutionalInternetBridgeChooseSurface } from '@/components/journey/ConstitutionalInternetBridgeChooseSurface';
import { ConstitutionalInternetBridgePassportGate } from '@/components/journey/ConstitutionalInternetBridgePassportGate';
import { KnytsBridgeAdminPanel } from '@/components/journey/KnytsBridgeAdminPanel';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { usePersonaSpine } from '@/utils/personaSpine';
import { CodexCopilotLayer } from '@/app/components/codex/CodexCopilotLayer';
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
};

const CI_COPILOT_QUICK_PROMPTS = [
  'What does this mean?',
  'Why personhood before identity?',
  'How do I connect Claude?',
];

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

export default function ConstitutionalInternetBridgePage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [citizenPassportUsable, setCitizenPassportUsable] = useState<boolean | undefined>(undefined);
  const [showPassportGate, setShowPassportGate] = useState(false);
  const spine = usePersonaSpine();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('currentPersonaId');
      if (stored) setPersonaId(stored);
    } catch {
      /* storage unavailable — stays signed-out */
    }
  }, []);

  const [previousStageId, setPreviousStageId] = useState<string | undefined>(undefined);
  const [currentStageId, setCurrentStageId] = useState<string | undefined>(undefined);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost('ConstitutionalInternetBridgeFrontDoor');

  // Track stage navigation for back button functionality and passport gating
  useEffect(() => {
    const handleStageSelect = (event: Event) => {
      const customEvent = event as CustomEvent<{ stageId: string }>;
      const targetStageId = customEvent.detail.stageId;

      // Gate: remix and personify require a claimed passport
      if ((targetStageId === 'personify' || targetStageId === 'remix') && !citizenPassportUsable) {
        setShowPassportGate(true);
        return; // Don't advance the stage
      }

      setPreviousStageId(currentStageId);
      setCurrentStageId(targetStageId);
    };
    window.addEventListener('journey:select-stage', handleStageSelect);
    return () => window.removeEventListener('journey:select-stage', handleStageSelect);
  }, [currentStageId, citizenPassportUsable]);

  const handleBack = useCallback(() => {
    if (previousStageId) {
      selectStage(previousStageId);
    }
  }, [previousStageId]);

  const resolveSurfaceProps = useCallback(
    ({ surfaceRef, runtimeState }: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => {
      if (surfaceRef.ref === 'ci-bridge-passport-room') {
        const passportStage = runtimeState?.stages.find((s) => s.stageId === 'passport');
        const isPassportUsable = passportStage?.evidencePresent.includes('citizenPassportUsable');
        setCitizenPassportUsable(isPassportUsable);
        return {
          citizenPassportUsable: isPassportUsable,
          personaId,
        };
      }
      if (surfaceRef.ref === 'ci-bridge-home') {
        return {
          onPrimaryCta: () => selectStage('view'),
          onSecondaryCta: () => selectStage('choose'),
        };
      }
      if (surfaceRef.ref === 'ci-bridge-choose') {
        // "Meet aigentMe" opens the SAME floating Copilot drawer mounted
        // once below (targeted correction pass, 2026-08-11) — never a
        // second embedded metaMe surface. This is the existing personaId-
        // drilling channel (resolveSurfaceProps), just one more callback.
        return { personaId, onOpenAigentMeCopilot: () => setCopilotOpen(true) };
      }
      if (
        surfaceRef.ref === 'ci-bridge-view' ||
        surfaceRef.ref === 'ci-bridge-personify-mycanvas' ||
        // Fixed 2026-08-11 (integration pass) — STAND never received
        // personaId before this, so it always rendered its signed-out
        // "Claim your Passport" branch regardless of whether the visitor
        // actually had a persona. Same one-line fix pattern as the
        // Passport-room personaId omission fixed the same day.
        surfaceRef.ref === 'ci-bridge-stand'
      ) {
        return { personaId };
      }
      return {};
    },
    [personaId],
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
          accent={CI_ACCENT}
          compact
          onBack={handleBack}
          distinguishAvailableStages
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

        {/* Omnipresent aigentMe copilot — the existing canonical constitutional
            guide identity (data/codex-configs.ts's METAME_CODEX.copilot), not
            an invented CI-specific agent. */}
        <CodexCopilotLayer
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          onOpen={() => setCopilotOpen(true)}
          variant="floating"
          accentColor="emerald"
          agent={{ id: 'aigent-me', name: 'aigentMe' }}
          personaId={personaId}
          enableInferenceRendering
          contextId="ci-bridge"
          promptPlaceholder="Ask about the Constitutional Internet..."
          quickPrompts={CI_COPILOT_QUICK_PROMPTS}
          groundContext={{
            surface: 'ci-bridge',
            bridgeTitle: 'The Constitutional Internet Bridge',
            stageContent: CI_BRIDGE_VIEW_CONTENT.map(block => ({
              proposition: block.proposition,
              excerpt: block.excerpt,
              source: block.excerptSource,
            })),
          }}
        />

        {/* Passport gate — blocks access to REMIX/PERSONIFY until passport claimed */}
        <ConstitutionalInternetBridgePassportGate
          isOpen={showPassportGate}
          onDismiss={() => setShowPassportGate(false)}
          onProceedToPassport={() => {
            setShowPassportGate(false);
            selectStage('passport');
          }}
        />
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
