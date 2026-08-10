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
 * for the full reuse rationale):
 *   HOME    → BridgeMediaStage (the CI proposition)
 *   VIEW    → ConstitutionalInternetBridgeViewSequence (real Plates + excerpts)
 *   ORIENT  → ConstitutionalFrontierOrientSurface (deterministic questionnaire)
 *   PASSPORT→ ConstitutionalInternetBridgePassportRoom (state-aware: claim,
 *             or "you have crossed" + continue to ACT)
 *   ACT     → ConstitutionalAgentFieldEntrySurface (Connect Claude / Meet aigentMe)
 *   STAND   → ConstitutionalInternetBridgeStandPanel (real receipts + Standing)
 *   CHOOSE  → ConstitutionalInternetBridgeChooseSurface (destinations)
 *
 * This page hosts Passport sign-in itself (usePassportSignInHost +
 * PassportConnectPanel, the same surface /invite/[code]/page.tsx and
 * app/bridge/knyts/page.tsx use directly) because a bare page has no
 * SmartWalletDrawer anywhere in its tree to answer a PASSPORT_SIGN_IN
 * request otherwise — structural parity with KNYTS even though no CI
 * surface currently issues such a request (none needs to: PASSPORT is a
 * proper spine stage before ACT, reached in order).
 *
 * One floating copilot (CodexCopilotLayer) is mounted once here, using the
 * existing canonical aigentMe identity (data/codex-configs.ts's
 * METAME_CODEX.copilot: agent id 'aigent-me', accent emerald) rather than
 * inventing a new "aigent-ci" identity — there is no dedicated CI copilot
 * configured anywhere in this codebase, and aigentMe is the correct
 * existing constitutional guide for this Bridge's subject matter.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { JourneyRunSurface, type JourneyRunSurfaceProps } from '@/components/journey/JourneyRunSurface';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { BridgeMediaStage } from '@/components/journey/BridgeMediaStage';
import { ConstitutionalInternetBridgeViewSequence } from '@/components/journey/ConstitutionalInternetBridgeViewSequence';
import { ConstitutionalFrontierOrientSurface } from '@/components/journey/ConstitutionalFrontierOrientSurface';
import { ConstitutionalInternetBridgePassportRoom } from '@/components/journey/ConstitutionalInternetBridgePassportRoom';
import { ConstitutionalAgentFieldEntrySurface } from '@/components/journey/ConstitutionalAgentFieldEntrySurface';
import { ConstitutionalInternetBridgeStandPanel } from '@/components/journey/ConstitutionalInternetBridgeStandPanel';
import { ConstitutionalInternetBridgeChooseSurface } from '@/components/journey/ConstitutionalInternetBridgeChooseSurface';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { CodexCopilotLayer } from '@/app/components/codex/CodexCopilotLayer';
import { MetaAvatarProvider } from '@/app/contexts/MetaAvatarContext';

/** CI visual projection — indigo, never a change to JourneyRunSurface's own
 *  default (purple), which every other journey keeps. */
const CI_ACCENT = {
  node: 'border-indigo-400 bg-indigo-500/20 text-indigo-200',
  label: 'text-indigo-200',
  chip: 'bg-indigo-500/20 text-indigo-200',
};

const CI_BRIDGE_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  BridgeMediaStage,
  ConstitutionalInternetBridgeViewSequence,
  ConstitutionalFrontierOrientSurface,
  ConstitutionalInternetBridgePassportRoom,
  ConstitutionalAgentFieldEntrySurface,
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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('currentPersonaId');
      if (stored) setPersonaId(stored);
    } catch {
      /* storage unavailable — stays signed-out */
    }
  }, []);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost('ConstitutionalInternetBridgeFrontDoor');

  const resolveSurfaceProps = useCallback(
    ({ surfaceRef, runtimeState }: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => {
      if (surfaceRef.ref === 'ci-bridge-passport-room') {
        const passportStage = runtimeState?.stages.find((s) => s.stageId === 'passport');
        return { citizenPassportUsable: passportStage?.evidencePresent.includes('citizenPassportUsable') };
      }
      if (surfaceRef.ref === 'ci-bridge-home') {
        return {
          onPrimaryCta: () => selectStage('view'),
          onSecondaryCta: () => selectStage('choose'),
        };
      }
      return {};
    },
    [],
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
          headerLabel={
            <>
              <span className="shrink-0 font-semibold text-slate-100">Constitutional Internet Bridge</span>
              <span className="shrink-0 text-slate-600">·</span>
              <span className="truncate text-indigo-300">Threshold Guide</span>
            </>
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
                  selectStage('act');
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
        />
      </div>
    </MetaAvatarProvider>
  );
}
