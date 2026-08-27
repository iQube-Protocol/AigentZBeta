'use client';

/**
 * FinancialServicesHandoffLanding — the Differ × Financial Services Bridge
 * pilot, part 5: the native landing route the browser opens after Differ
 * requests a handoff and navigates the user here.
 *
 * On mount: redeems the handoff via `POST
 * /api/adaptive/financial-services/handoffs/[handoffId]/redeem` (a spine
 * endpoint — `personaFetch` per CLAUDE.md's Identity & Access Spine rule,
 * never raw `fetch`). That single call performs everything spec'd for this
 * stage: validates + atomically consumes the handoff, re-resolves the
 * principal and current authority, confirms the capability is still
 * eligible, and resolves the destination through the existing catalogue/
 * journey machinery (`resolveJourneyOperatorDestination`) — see
 * `services/adaptive/nativeHandoff.ts`.
 *
 * This component NEVER executes the underlying MoneyPenny act itself. It
 * only (a) embeds the EXACT, unmodified, already-registered MoneyPenny
 * native surface the destination resolved to, via the same embed mechanism
 * every other cartridge embed in this codebase uses, and (b) supplies
 * "Done" / "Cancel" navigation chrome AROUND that embed — never inside it,
 * never a parallel MoneyPenny UI. The user still has to act inside the real,
 * unmodified surface for anything to actually happen.
 *
 * The "Done"/"Cancel" affordances build the completion callback contract
 * (`{ handoffId, outcome }`) and navigate to Differ's own `returnUrl`. This
 * is explicitly NOT completion evidence — Differ is expected to refetch the
 * projection endpoint, never to trust this callback (see the Differ adapter,
 * services/differAdapter/financialServicesClient.ts).
 */

import { useEffect, useState } from 'react';
import { personaFetch } from '@/utils/personaSpine';

interface RedeemSuccess {
  ok: true;
  journeyId: string;
  stageId: string | null;
  capabilityId: string;
  nativeSurfaceRef: string;
  route: string | null;
  returnUrl: string;
}

interface RedeemFailure {
  ok: false;
  error: string;
  reason?: string;
}

type RedeemResponse = RedeemSuccess | RedeemFailure;

type LandingState =
  | { phase: 'redeeming' }
  | { phase: 'ready'; result: RedeemSuccess }
  | { phase: 'failed'; error: string; reason?: string };

function callbackUrl(returnUrl: string, handoffId: string, outcome: 'native-act-finished' | 'cancelled'): string {
  try {
    const u = new URL(returnUrl);
    u.searchParams.set('handoffId', handoffId);
    u.searchParams.set('outcome', outcome);
    return u.toString();
  } catch {
    return returnUrl;
  }
}

export function FinancialServicesHandoffLanding({ handoffId }: { handoffId: string }) {
  const [state, setState] = useState<LandingState>({ phase: 'redeeming' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch(`/api/adaptive/financial-services/handoffs/${encodeURIComponent(handoffId)}/redeem`, {
          method: 'POST',
        });
        const data = (await res.json().catch(() => null)) as RedeemResponse | null;
        if (cancelled) return;
        if (data?.ok) {
          setState({ phase: 'ready', result: data });
        } else {
          setState({
            phase: 'failed',
            error: data?.error ?? `Redemption failed (HTTP ${res.status})`,
            reason: data?.reason,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({ phase: 'failed', error: e instanceof Error ? e.message : 'Redemption failed' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handoffId]);

  if (state.phase === 'redeeming') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-300">
        <p className="text-sm">Opening MoneyPenny…</p>
      </div>
    );
  }

  if (state.phase === 'failed') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-300">
        <p className="text-sm text-rose-400">This handoff could not be opened.</p>
        <p className="max-w-md text-xs text-slate-500">{state.error}</p>
      </div>
    );
  }

  const { result } = state;

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 py-2.5">
        <span className="text-xs text-slate-400">MoneyPenny — {result.capabilityId}</span>
        <div className="flex items-center gap-2">
          <a
            href={callbackUrl(result.returnUrl, handoffId, 'cancelled')}
            className="rounded border border-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200"
          >
            Cancel
          </a>
          <a
            href={callbackUrl(result.returnUrl, handoffId, 'native-act-finished')}
            className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20"
          >
            Done — return to Differ
          </a>
        </div>
      </div>
      {result.route ? (
        <iframe title="MoneyPenny" src={result.route} className="w-full flex-1 border-0" />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
          The registered MoneyPenny destination could not be resolved.
        </div>
      )}
    </div>
  );
}

export default FinancialServicesHandoffLanding;
