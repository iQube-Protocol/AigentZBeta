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
 * DIRECT OPERATE DEEP-LINK (2026-08-24, Catalogue Helper closeout, refined
 * same day per operator direction — "separate metaMe activation from
 * aigentMe activation") —
 * `services/journey/catalogueDestinationHelper.ts`'s
 * `resolveJourneyOperatorDestination()` is the ONLY place this page decides
 * where "Operate" actually lands. Once the operator holds a usable Citizen
 * Passport, this page's DEFAULT foregrounded content is a direct embed of
 * MoneyPenny's Orchestration console — the operator never has to stop at
 * MyCanvas, the metaMe Catalogue page, or MoneyPenny's own root tab first.
 *
 * This default is deliberately NOT conditioned on the `aigentme` stage's own
 * completion. metaMe activation (what's foregrounded when Operate is
 * reached) and aigentMe activation (that stage's own welcome/focus-
 * disposition ceremony) are two separate things:
 *   - metaMe = the operating environment. Default at Operate: MoneyPenny
 *     Orchestration.
 *   - aigentMe = one agent/capability WITHIN that environment, reachable
 *     through the embed's own full navigation chrome (never suppressed
 *     here — `buildCodexUrl` is called without `focused`, so the standard
 *     0/1/2/Full navigation-depth mechanics stay exactly as they are
 *     elsewhere) or through the "View Journey" toggle below.
 *
 * `services/journey/horizenMoneyPennyJourney.ts` is completely untouched:
 * the `aigentme` stage's `completionEvidence` (`focusDispositionRecorded`)
 * is still only recordable inside the aigentme-welcome shell's Welcome
 * Capsule, reached exactly as before — by navigating to aigentMe from within
 * the MoneyPenny embed's own full navigation chrome (never suppressed) or
 * through the stage stepper's own normal navigation. MoneyPenny never
 * records, derives, or synthesizes that evidence — it has no code path that
 * references it at all. Journey guidance determines the recommended/default
 * path, never the maximum accessible capability depth: a task-focused
 * operator can stay entirely inside MoneyPenny; an advanced operator can
 * expand into full metaMe and reach aigentMe (or anything else) exactly as
 * today.
 */

import { useCallback, useEffect, useState } from 'react';
import { PilotJourneyTab } from '@/app/triad/components/codex/tabs/PilotJourneyTab';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { usePersonaSpine } from '@/utils/personaSpine';
import type { JourneyRuntimeState } from '@/types/journey';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveJourneyOperatorDestination } from '@/services/journey/catalogueDestinationHelper';

export function FinancialServicesBridgeFrontDoor() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  usePersonaSpine();

  // Derived exclusively from onRuntimeStateChange — never re-read from a
  // second observer (CFS-055 coherence discipline, same as the CI bridge).
  const [citizenPassportUsable, setCitizenPassportUsable] = useState<boolean | undefined>(undefined);

  const handleRuntimeStateChange = useCallback((state: JourneyRuntimeState) => {
    const passportStage = state.stages.find((s) => s.stageId === 'passport');
    setCitizenPassportUsable(Boolean(passportStage?.evidencePresent.includes('operatorPolityCitizenPassportValid')));
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

  // Projection layer: MoneyPenny Orchestration is the foreground for aigentme
  // (product-facing "Operate" label) when post-Passport, but the Journey Spine
  // and all navigation remain unchanged (operator direction, 2026-08-24,
  // "separate metaMe activation from aigentMe activation"). The stage stepper
  // stays visible; only the aigentme stage's surface is overridden. If
  // resolution fails, this stays undefined and PilotJourneyTab renders the
  // normal aigentme surfaces.
  const foregroundSurfacesByStage = destination.valid && destination.activationMode === 'CATALOGUE_ACTIVATION'
    ? {
        aigentme: (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2">
              <span className="text-xs text-slate-400">
                Financial Services — Operate → <span className="text-emerald-300">MoneyPenny Orchestration</span>
              </span>
            </div>
            <iframe
              src={destination.operatorDestination.route}
              title="MoneyPenny Orchestration"
              className="w-full flex-1 border-0"
            />
          </div>
        ),
      }
    : undefined;

  return (
    <div className="min-h-screen bg-slate-950">
      <PilotJourneyTab
        personaId={personaId}
        onRuntimeStateChange={handleRuntimeStateChange}
        foregroundSurfacesByStage={foregroundSurfacesByStage}
      />

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
