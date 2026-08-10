'use client';

/**
 * KnytsBridgePassportRoom — the PASSPORT stage's state-aware surface
 * (surface reconciliation, 2026-08-09): "the stage shouldn't show a Citizen
 * Passport application to somebody whose Passport is already present...
 * Passport becomes a constitutional-state-aware room."
 *
 *   NO PASSPORT           → claim it (the canonical PassportBureauApplyTab —
 *                           never a campaign-specific fork).
 *   PASSPORT ESTABLISHED  → "You have crossed." + the existing aigentMe
 *                           dashboard (the SAME 'aigentme-welcome' embed
 *                           Horizen's own journey uses), which already
 *                           presents "meet your companion" / delegate-when-
 *                           ready / delegated natively — never a second,
 *                           bespoke delegation-state UI built here.
 *
 * `citizenPassportUsable` is the SAME evidence value the Passport stage's
 * own completion already resolves from (services/identity/passportPrincipal.ts
 * via /api/journey/knyts-bridge/state) — threaded in by the page's
 * `resolveSurfaceProps`, never re-derived here (one observer, one record).
 * Passport completion itself does NOT require delegation (reconstitution
 * spec, point 9) — this room's second half is an invitation, not a gate.
 */

import { CheckCircle2 } from 'lucide-react';
import { PassportBureauApplyTab } from '@/app/triad/components/codex/tabs/PassportBureauApplyTab';
import { buildCodexUrl } from '@/utils/codex-nav';

interface Props {
  personaId?: string;
  /** Undefined while the journey's first state read is still in flight —
   *  treated the same as "not yet established" so the claim flow is always
   *  the safe default until evidence says otherwise. */
  citizenPassportUsable?: boolean;
}

export function KnytsBridgePassportRoom({ personaId, citizenPassportUsable }: Props) {
  if (!citizenPassportUsable) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">First constitutional act</p>
          <p className="mt-1 text-sm text-slate-300">Claim your Polity Citizen Passport.</p>
        </div>
        <PassportBureauApplyTab personaId={personaId} />
      </div>
    );
  }

  const aigentMeSrc = buildCodexUrl('metame-codex', {
    tab: 'aigent-me',
    personaId,
    shell: 'embed',
    suppressCopilot: true,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
        <div>
          <p className="text-sm font-semibold text-emerald-200">You have crossed.</p>
          <p className="mt-0.5 text-xs text-emerald-300/80">
            Your constitutional presence is confirmed. Meet your companion below, and delegate when you're ready.
          </p>
        </div>
      </div>
      <iframe
        src={aigentMeSrc}
        title="aigentMe"
        className="h-[36rem] w-full rounded-md border border-slate-800 bg-slate-950"
      />
    </div>
  );
}

export default KnytsBridgePassportRoom;
