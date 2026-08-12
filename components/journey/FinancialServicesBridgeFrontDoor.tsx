'use client';

/**
 * FinancialServicesBridgeFrontDoor — the ONE implementation both `/bridge/fs`
 * and `/bridge/financial-services` mount (2026-08-12, KNYTS↔CI parity pass,
 * FS Bridge section). Before this pass, the metaMe × Horizen Constitutional
 * Admission Journey (services/journey/horizenMoneyPennyJourney.ts) was
 * reachable ONLY through the Partner cartridge's PilotJourneyTab
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
 */

import { useEffect, useState } from 'react';
import { PilotJourneyTab } from '@/app/triad/components/codex/tabs/PilotJourneyTab';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { usePersonaSpine } from '@/utils/personaSpine';

export function FinancialServicesBridgeFrontDoor() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  usePersonaSpine();

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

  return (
    <div className="min-h-screen bg-slate-950">
      <PilotJourneyTab personaId={personaId} />

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
