'use client';

/**
 * ConstitutionalInternetBridgePassportRoom — the PASSPORT stage's state-aware
 * surface, mirroring KnytsBridgePassportRoom's exact pattern:
 *
 *   NO USABLE PASSPORT    → claim it (the canonical PassportBureauApplyTab —
 *                           never a campaign-specific fork).
 *   PASSPORT ESTABLISHED  → "You have crossed." + a continuation toward ACT.
 *
 * Unlike KnytsBridgePassportRoom, the post-crossing state does NOT embed
 * aigentMe inline — CI's own ACT stage IS the agent-connection/disposition
 * experience (ConstitutionalAgentFieldEntrySurface), so embedding it again
 * here would be the same surface rendered twice. This room simply invites
 * the visitor onward via the shared `journey:select-stage` dispatch every
 * other Threshold Guide stage uses to navigate the spine.
 *
 * `citizenPassportUsable` is the SAME evidence value the Passport stage's
 * own completion already resolves from (services/identity/passportPrincipal.ts
 * via /api/journey/constitutional-internet-bridge/state), threaded in by the
 * page's `resolveSurfaceProps`, never re-derived here (one observer, one
 * record).
 */

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { PassportBureauApplyTab } from '@/app/triad/components/codex/tabs/PassportBureauApplyTab';

interface Props {
  personaId?: string;
  /** Undefined while the journey's first state read is still in flight —
   *  treated the same as "not yet established" so the claim flow is always
   *  the safe default until evidence says otherwise. */
  citizenPassportUsable?: boolean;
}

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

export function ConstitutionalInternetBridgePassportRoom({ personaId, citizenPassportUsable }: Props) {
  if (!citizenPassportUsable) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">First constitutional act</p>
          <p className="mt-1 text-sm text-slate-300">Claim your Polity Citizen Passport.</p>
        </div>
        <PassportBureauApplyTab personaId={personaId} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
        <div>
          <p className="text-sm font-semibold text-emerald-200">You have crossed.</p>
          <p className="mt-0.5 text-xs text-emerald-300/80">
            Your constitutional presence is confirmed. Bring an agent into the field next.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => selectStage('act')}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="text-sm font-semibold text-white">Bring your agent into the field</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}

export default ConstitutionalInternetBridgePassportRoom;
