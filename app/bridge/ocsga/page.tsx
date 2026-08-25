'use client';

/**
 * /bridge/ocsga — Ian's real invitation URL for the OCSGA × Constitutional
 * Computing Research Collaboration (SPEC-JS-001 §14).
 *
 * A deliberately minimal standalone page — no admin panel, no floating
 * copilot. It mounts IanJourneyTab (a thin wrapper around the shared
 * JourneyRunSurface runner every journey in this codebase uses) plus the
 * SAME Passport sign-in hosting pattern app/bridge/knyts/page.tsx and
 * app/bridge/ci/page.tsx already use — usePassportSignInHost +
 * PassportConnectPanel, hosted inline because a bare page has no
 * SmartWalletDrawer anywhere in its tree to answer a PASSPORT_SIGN_IN
 * request otherwise. Nothing on this page is a new auth/onboarding
 * mechanism — see components/journey/IanOrientationPanel.tsx for the
 * requester side (usePassportSignInGate), the same pattern MyCanvasTab's
 * Remix gate already uses.
 *
 * First-touch flow (2026-08-24):
 *   invitation URL → /api/journey/ian/state (browsable signed-out, no 401)
 *   → Orient's "Sign in to continue" requests PASSPORT_SIGN_IN
 *   → this page hosts PassportConnectPanel inline
 *   → onConnected re-resolves personaId AND completes the sign-in request
 *   → IanOrientationPanel's gate retries the SAME acknowledge intent
 *   → JourneyRunSurface's own personaId-keyed refresh() re-reads
 *     authoritative state — Ian lands back on /bridge/ocsga at the correct
 *     stage, never a second URL, never a fabricated completion.
 *
 * MetaAvatarProvider/MetaAvatarHost wrap this bare page for the same reason
 * KNYTS/CI/FS Bridge each add their own instance (2026-08-10/11/25) — this
 * page sits outside both app/(shell)/layout.tsx and app/(embed)/layout.tsx,
 * the only two places that otherwise supply the context CodexCopilotLayer's
 * useMetaAvatar() requires. Needed as of the Journey Runtime copilot
 * invariant (item 1, semantic repair 2026-08-25): JourneyRunSurface now
 * mounts JourneyCopilotHost (which uses CodexCopilotLayer) unconditionally,
 * so this bare OCSGA page needs the same provider every other bare Journey
 * page already carries. Omitting it broke the Amplify build — prerendering
 * threw "useMetaAvatar must be used within a MetaAvatarProvider".
 */

import { useCallback, useEffect, useState } from 'react';
import { IanJourneyTab } from '@/app/triad/components/codex/tabs/IanJourneyTab';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { MetaAvatarProvider } from '@/app/contexts/MetaAvatarContext';
import { MetaAvatarHost } from '@/app/components/metaVatar/MetaAvatarHost';

export default function OcsgaJourneyPage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);

  const readStoredPersonaId = useCallback(() => {
    try {
      const stored = window.localStorage.getItem('currentPersonaId');
      if (stored) setPersonaId(stored);
    } catch {
      /* storage unavailable — stays signed-out */
    }
  }, []);

  useEffect(() => {
    readStoredPersonaId();
  }, [readStoredPersonaId]);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost('OcsgaBridge');

  return (
    <MetaAvatarProvider defaultAgent="aigent-researcher">
    <div className="h-screen bg-slate-950 text-slate-100">
      <IanJourneyTab personaId={personaId} />

      {/* PASSPORT — hosted inline, same pattern as the KNYTS/CI bridges */}
      {showPassportSignIn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden">
            <PassportConnectPanel
              world="application"
              embedded
              onConnected={() => {
                readStoredPersonaId();
                completeSignIn();
              }}
            />
            <button
              type="button"
              onClick={dismissSignIn}
              className="w-full border-t border-white/10 px-4 py-2.5 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
    <MetaAvatarHost />
    </MetaAvatarProvider>
  );
}
