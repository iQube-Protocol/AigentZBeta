'use client';

/**
 * FinancialServicesBridgeFrontDoor — the ONE implementation both `/bridge/fs`
 * and `/bridge/financial-services` mount (2026-08-12, KNYTS↔CI parity pass,
 * FS Bridge section; extended 2026-08-24, Catalogue Helper closeout). Before
 * the 2026-08-12 pass, the metaMe × Horizen Constitutional Admission Journey
 * (services/journey/horizenMoneyPennyJourney.ts) was reachable ONLY through
 * the Partner cartridge's PilotJourneyTab
 * (app/triad/components/codex/tabs/PilotJourneyTab.tsx, mounted inside
 * PartnerProgrammesTab's `adminOnly` "Pilot" tab). The operator's directive
 * was explicit: expose the SAME journey at bare public routes, as thin
 * adapters — "clone PilotJourneyTab", "create a second Horizen state route",
 * "rename persisted Horizen identifiers", "move the Partner cartridge
 * implementation", and "fork any POSIT/DVN/Observer/AR logic" were all named
 * as forbidden. This component does none of that: it mounts
 * `PilotJourneyTab` itself — the exact same component, same
 * `HORIZEN_MONEYPENNY_JOURNEY` definition, same
 * `/api/journey/moneypenny-horizen/state` observer, same surfaces, same
 * receipts the Partner path renders. There is no second implementation for
 * either new URL to drift from — both, and the existing Partner path, share
 * this one component tree.
 *
 * Wallet-surface hosting mirrors the established CI/KNYTS Bridge pattern
 * exactly (usePassportSignInHost + PassportConnectPanel, the same surface
 * /invite/[code]/page.tsx uses directly) because a bare page — unlike the
 * Partner cartridge, which always has a SmartWalletDrawer mounted in its
 * CodexPanelDynamic tree — has nothing else to answer a PASSPORT_SIGN_IN
 * interrupt with. Register's own PRINCIPAL_WALLET_PROVISIONING request
 * (components/journey/RegisterAgentPanel.tsx) is NOT hosted here — that
 * ceremony was always reached through the cartridge shell's own
 * SmartWalletDrawer, and building a second wallet-hosting surface for it
 * would be exactly the forked implementation the operator's directive rules
 * out. A visitor who reaches Register from this bare front door and
 * provisions no principal wallet elsewhere sees that stage's own honest
 * "prerequisite not met" state — the same thing the Partner path shows
 * before a wallet exists, never a silent failure.
 *
 * DIRECT OPERATE DEEP-LINK (2026-08-24, Catalogue Helper closeout) —
 * `services/journey/catalogueDestinationHelper.ts`'s
 * `resolveJourneyOperatorDestination()` is the ONLY place this page decides
 * where "Operate" actually lands. Once the operator holds a usable Citizen
 * Passport AND the journey's `aigentme` (Operate) stage is COMPLETE, this
 * page swaps its primary content from the Journey stepper to a direct embed
 * of MoneyPenny's Orchestration console — the operator never has to stop at
 * MyCanvas, the metaMe Catalogue page, or MoneyPenny's own root tab first.
 *
 * This does NOT touch the `aigentme` stage's own definition, evidence, or
 * completion mechanism (services/journey/horizenMoneyPennyJourney.ts is
 * untouched): that stage's `focusDispositionRecorded` completion evidence is
 * still only recordable inside the aigentme-welcome shell's Welcome Capsule,
 * so the FIRST time an operator reaches Operate they still see the Journey
 * stepper (with that shell) until the ceremony is complete — a one-time
 * bootstrap, not a routine detour. Every subsequent visit (stage already
 * COMPLETE) lands directly on Orchestration. A "View Journey" toggle stays
 * available so the operator can always reach the stepper (other stages,
 * receipts, progress) on purpose.
 */

import { useCallback, useEffect, useState } from 'react';
import { PilotJourneyTab } from '@/app/triad/components/codex/tabs/PilotJourneyTab';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { usePersonaSpine } from '@/utils/personaSpine';
import type { JourneyRuntimeState } from '@/types/journey';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveJourneyOperatorDestination } from '@/services/journey/catalogueDestinationHelper';
import { ArrowLeft } from 'lucide-react';

export function FinancialServicesBridgeFrontDoor() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  usePersonaSpine();

  // Derived exclusively from onRuntimeStateChange — never re-read from a
  // second observer (CFS-055 coherence discipline, same as the CI bridge).
  const [citizenPassportUsable, setCitizenPassportUsable] = useState<boolean | undefined>(undefined);
  const [operateComplete, setOperateComplete] = useState<boolean>(false);
  // Manual override: an operator who reached Orchestration directly can
  // still ask to see the Journey stepper (other stages, receipts, progress)
  // on purpose. Reset to false whenever the underlying resolution flips
  // back to PUBLIC_ORIENTATION, so a signed-out visit never gets stuck on it.
  const [viewJourneyOverride, setViewJourneyOverride] = useState(false);

  const handleRuntimeStateChange = useCallback((state: JourneyRuntimeState) => {
    const passportStage = state.stages.find((s) => s.stageId === 'passport');
    setCitizenPassportUsable(Boolean(passportStage?.evidencePresent.includes('operatorPolityCitizenPassportValid')));
    const operateStage = state.stages.find((s) => s.stageId === 'aigentme');
    setOperateComplete(operateStage?.state === 'COMPLETE');
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('currentPersonaId');
      if (stored) setPersonaId(stored);
    } catch {
      /* storage unavailable — stays signed-out */
    }
  }, []);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost(
    'FinancialServicesBridgeFrontDoor',
  );

  // Fails visibly if the registered destination stops resolving (a renamed
  // catalogue id, a deleted tab) — never a silent fallback to a generic
  // surface. citizenPassportUsable defaults to false (PRE_PASSPORT) while
  // the first read is in flight, which is the correct fail-safe: an unknown
  // threshold state must never resolve to CATALOGUE_ACTIVATION.
  const destination = resolveJourneyOperatorDestination({
    journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
    participantState: { citizenPassportUsable: citizenPassportUsable === true },
    navOptions: { personaId },
  });

  const showOrchestrationDirectly =
    destination.valid &&
    destination.activationMode === 'CATALOGUE_ACTIVATION' &&
    operateComplete &&
    !viewJourneyOverride;

  return (
    <div className="min-h-screen bg-slate-950">
      {showOrchestrationDirectly && destination.valid ? (
        <div className="flex h-screen flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2">
            <span className="text-xs text-slate-400">
              Financial Services — Operate → <span className="text-emerald-300">MoneyPenny Orchestration</span>
            </span>
            <button
              type="button"
              onClick={() => setViewJourneyOverride(true)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-none border-none cursor-pointer p-0"
            >
              <ArrowLeft className="h-3 w-3" /> View Journey
            </button>
          </div>
          <iframe
            src={destination.operatorDestination.route}
            title="MoneyPenny Orchestration"
            className="w-full flex-1 border-0"
          />
        </div>
      ) : (
        <>
          {destination.valid && destination.activationMode === 'CATALOGUE_ACTIVATION' && operateComplete && (
            <div className="flex items-center justify-end border-b border-slate-800 bg-slate-900/60 px-4 py-2">
              <button
                type="button"
                onClick={() => setViewJourneyOverride(false)}
                className="text-[11px] text-emerald-300 hover:text-emerald-200 bg-none border-none cursor-pointer p-0"
              >
                Continue to MoneyPenny Orchestration →
              </button>
            </div>
          )}
          <PilotJourneyTab personaId={personaId} onRuntimeStateChange={handleRuntimeStateChange} />
        </>
      )}

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
    </div>
  );
}

export default FinancialServicesBridgeFrontDoor;
