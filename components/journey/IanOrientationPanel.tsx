'use client';

/**
 * IanOrientationPanel — the Ian Boundary Research journey's Orient stage
 * surface (SPEC-JS-001 §14.4 PHASE A).
 *
 * Deliberately NOT a reuse of components/journey/OrientationPanel.tsx: that
 * panel performs its OWN GET read against the Horizen agent-orientation
 * ritual (services/journey/orientationContext.ts, a different capability
 * instance scoped to external-agent admission). Per JourneyRunSurface's own
 * three-layer rule ("projection consumes observer state only; no stepper
 * component may query lower-level evidence directly"), this panel takes its
 * completion state from the ALREADY-RESOLVED `runtimeState` the caller
 * passes in via `resolveSurfaceProps` — it never re-derives or re-fetches
 * "is Orient done" on its own. Its one guided action posts to
 * /api/journey/ian/orient/acknowledge, then asks the observer to reread via
 * `requestStateRefresh` — never trusting its own POST's echo.
 *
 * First-touch sign-in (2026-08-24) — the SAME requester/host pattern
 * MyCanvasTab's Remix gate already uses (app/hooks/usePassportSignInGate.ts,
 * app/hooks/usePassportSignInHost.ts), never a new auth mechanism. `orient`
 * is browsable signed-out (/api/journey/ian/state tolerates no persona), but
 * the acknowledge ACT genuinely needs identity. `personaId` arrives as a
 * prop automatically — JourneyRunSurface forwards it to every stage
 * component. When absent, the button requests Passport sign-in instead of
 * calling acknowledge directly; `onSignedIn` only sets a flag (mirroring
 * MyCanvasTab's own comment: "personaId itself updates reactively via the
 * aa-persona-change-v1 broadcast... the effect below promotes it once it
 * does") — the retry fires from a separate effect keyed on the NEXT render
 * where `personaId` has actually arrived, never from inside the completion
 * callback itself, which would risk a stale-closure race against the
 * personaId prop update.
 *
 * OCSGA EARLY INVITATION ENTRY (2026-08-25) — an OPTIONAL, ADDITIVE
 * invitation-code field, independent of the acknowledge action above.
 * Constitutional distinction (the whole reason this is a separate act, never
 * folded into acknowledge): an invitation is a collaboration/admission
 * context, never proof of personhood — it associates this persona with a
 * Reciprocal Artifact Exchange (services/research/reciprocalExchange.ts,
 * PRD-IRL-AX-001) as its counterparty, exactly what the ALREADY-EXISTING
 * "Join with an invitation code" box in IRLExchangeTab does later in the
 * flow (app/triad/components/codex/tabs/IRLExchangeTab.tsx, the
 * `POST /api/research/exchanges/join` route). This panel calls the SAME
 * route — no second invitation schema, validator, or receipt type. Applying
 * an already-associated code again is idempotent because `joinExchange`
 * itself is (services/research/reciprocalExchange.ts: re-joining as the
 * SAME persona who already holds the counterparty slot returns `ok: true`
 * with no write). A rejected/invalid code only sets local error state — it
 * never disables or blocks the acknowledge button above; the two actions
 * are fully independent.
 *
 * `activeExchangeId` arrives as a prop, resolved server-side by
 * /api/journey/ian/state (never re-derived here) — when present, this panel
 * shows an "associated" state instead of an open input, so it never demands
 * a code that has already been supplied (mirrored by IRLExchangeTab's own
 * later-surface behavior). It does not expose a "replace" affordance:
 * changing collaboration context is deliberately not a one-click action from
 * this early surface.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Link2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';
import { usePassportSignInGate } from '@/app/hooks/usePassportSignInGate';

interface IanOrientationPanelProps {
  personaId?: string;
  complete: boolean;
  requestStateRefresh: () => void;
  /** The Reciprocal Artifact Exchange this persona is already associated
   *  with (either party), resolved server-side — see the module doc comment.
   *  `null`/`undefined` means no invitation has been associated yet. */
  activeExchangeId?: string | null;
  /**
   * OCSGA structural admission fix (2026-08-26) — true when `activeExchangeId`
   * was recognized/provisioned from this persona's own active Research Lab
   * grant (services/journey/boundaryResearchExchangeAdmission.ts), rather
   * than a manually-entered `rax-` code. Resolved server-side, never
   * re-derived here — governs COPY ONLY; the invitation-code box is already
   * correctly suppressed by `activeExchangeId` alone (see `inviteSection`
   * below), so a grant-admitted participant never sees or is asked for a
   * separate `rax-` invitation either way.
   */
  ocsgaGrantAdmitted?: boolean;
}

export function IanOrientationPanel({ personaId, complete, requestStateRefresh, activeExchangeId, ocsgaGrantAdmitted }: IanOrientationPanelProps) {
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAfterSignIn, setPendingAfterSignIn] = useState(false);

  const acknowledge = useCallback(async () => {
    setAcknowledging(true);
    setError(null);
    try {
      const res = await personaFetch('/api/journey/ian/orient/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        personaIdHint: personaId,
      });
      const json = await readJsonOrExplain(res, 'ian/orient/acknowledge');
      if (!res.ok || !json.ok) throw new Error(typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`);
      requestStateRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your acknowledgment.');
    } finally {
      setAcknowledging(false);
    }
  }, [personaId, requestStateRefresh]);

  const { requestSignIn, handoffUnanswered } = usePassportSignInGate({
    origin: 'IanOrientationPanel',
    returnTarget: 'journey:ocsga:orient-acknowledge',
    returnLabel: 'Continue your OCSGA crossing',
    onSignedIn: useCallback(() => {
      setPendingAfterSignIn(true);
    }, []),
  });

  // Fires once personaId has actually arrived as a prop (the render AFTER
  // the sign-in completion, never inside the completion callback itself).
  useEffect(() => {
    if (pendingAfterSignIn && personaId) {
      setPendingAfterSignIn(false);
      void acknowledge();
    }
  }, [pendingAfterSignIn, personaId, acknowledge]);

  const handleClick = useCallback(() => {
    if (!personaId) {
      requestSignIn();
      return;
    }
    void acknowledge();
  }, [personaId, requestSignIn, acknowledge]);

  // ── OCSGA early invitation entry (2026-08-25) ──────────────────────────
  const [inviteCode, setInviteCode] = useState('');
  const [applyingInvite, setApplyingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pendingInviteAfterSignIn, setPendingInviteAfterSignIn] = useState(false);

  const applyInvite = useCallback(async () => {
    if (!inviteCode.trim()) return;
    setApplyingInvite(true);
    setInviteError(null);
    try {
      const res = await personaFetch('/api/research/exchanges/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        personaIdHint: personaId,
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const json = await readJsonOrExplain(res, 'research/exchanges/join');
      if (!res.ok || !json.ok) throw new Error(typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`);
      setInviteCode('');
      // Never trust this POST's own echo — the SAME re-read acknowledge()
      // already relies on, so activeExchangeId only ever reflects the
      // observer's authoritative state.
      requestStateRefresh();
    } catch (err) {
      // A rejected/invalid code stays local — it never blocks acknowledge()
      // or the rest of the journey; it simply remains unassociated.
      setInviteError(err instanceof Error ? err.message : 'Could not apply that invitation code.');
    } finally {
      setApplyingInvite(false);
    }
  }, [inviteCode, personaId, requestStateRefresh]);

  const { requestSignIn: requestInviteSignIn, handoffUnanswered: inviteHandoffUnanswered } = usePassportSignInGate({
    origin: 'IanOrientationPanel',
    // Unique returnTarget (distinct from orient-acknowledge above) — two
    // concurrent gates on the same panel must not cross-fire each other's
    // completions (usePassportSignInGate's own doc comment).
    returnTarget: 'journey:ocsga:orient-invite-apply',
    returnLabel: 'Apply your invitation code',
    onSignedIn: useCallback(() => {
      setPendingInviteAfterSignIn(true);
    }, []),
  });

  useEffect(() => {
    if (pendingInviteAfterSignIn && personaId) {
      setPendingInviteAfterSignIn(false);
      void applyInvite();
    }
  }, [pendingInviteAfterSignIn, personaId, applyInvite]);

  const handleApplyInviteClick = useCallback(() => {
    if (!personaId) {
      requestInviteSignIn();
      return;
    }
    void applyInvite();
  }, [personaId, requestInviteSignIn, applyInvite]);

  const waitingForInviteSignIn = pendingInviteAfterSignIn && !personaId;
  const inviteBusy = applyingInvite || waitingForInviteSignIn;

  const inviteSection = activeExchangeId ? (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span className="text-emerald-300">{ocsgaGrantAdmitted ? 'Research Lab grant recognized' : 'Invitation associated'}</span>
      </div>
      <p className="mt-1 opacity-80">
        {ocsgaGrantAdmitted
          ? "Your active OCSGA Research Lab grant admits you to this collaboration — no separate invitation code is needed. This is admission context only — it does not establish personhood or issue a Passport; that happens separately, next."
          : "You're associated with a collaboration invitation. This is admission context only — it does not establish personhood or issue a Passport; that happens separately, next."}
      </p>
    </div>
  ) : (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 space-y-2">
      <p className="text-xs font-medium text-slate-300">Invitation code (optional)</p>
      <p className="text-[11px] text-slate-500">
        If you were given a collaboration invitation code, you can apply it now or later — it&apos;s never required
        to continue.
      </p>
      <div className="flex gap-2">
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="rax-…"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100 outline-none focus:border-violet-500"
        />
        <button
          onClick={handleApplyInviteClick}
          disabled={inviteBusy || !inviteCode.trim()}
          className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
        >
          {applyingInvite ? 'Applying…' : waitingForInviteSignIn ? 'Finishing sign-in…' : 'Apply invitation'}
        </button>
      </div>
      {inviteHandoffUnanswered && (
        <p className="text-[11px] text-amber-400">No sign-in host answered — reload this page and try again.</p>
      )}
      {inviteError && <p className="text-[11px] text-rose-400">{inviteError}</p>}
    </div>
  );

  if (complete) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-medium">Oriented</p>
              <p className="mt-1 opacity-80">
                You understand the crossing. Constitutional presence comes next.
              </p>
            </div>
          </div>
        </div>
        {inviteSection}
      </div>
    );
  }

  const waitingForSignIn = pendingAfterSignIn && !personaId;
  const busy = acknowledging || waitingForSignIn;

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-4 space-y-3">
      <p className="text-sm text-slate-200">
        Boundary Research is a persistent knowledge commons for rigorous work between
        Constitutional Computing / IRL and OCSGA. You&apos;ve been invited to a reciprocal
        architecture exchange: both sides deposit and freeze an independent artifact, then
        sign a shared exchange instrument. Only once both sides are ready does the exchange
        cross and boundary comparison begin.
      </p>
      <p className="text-sm text-slate-400">
        This guide only ever asks you for what is actually required next — nothing more.
      </p>
      <button
        onClick={handleClick}
        disabled={busy}
        className="rounded-md border border-violet-800/60 bg-violet-950/30 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-900/40 disabled:opacity-50"
      >
        {acknowledging
          ? 'Recording…'
          : waitingForSignIn
            ? 'Finishing sign-in…'
            : personaId
              ? 'I understand — continue'
              : 'Sign in to continue'}
      </button>
      {handoffUnanswered && (
        <p className="text-xs text-amber-400">
          No sign-in host answered — reload this page and try again.
        </p>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {inviteSection}
    </div>
  );
}

export default IanOrientationPanel;
